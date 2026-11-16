"use client";

import { HyperFormula, type CellValue } from "hyperformula";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent, type PointerEvent } from "react";
import { saveExcel } from "@/lib/bank";
import { FUNCTION_NAMES, FUNCTIONS } from "@/lib/excel-functions";
import {
  addr,
  canInsertRef,
  colName,
  currentFunction,
  fnPrefix,
  normalizeFormula,
  parseAddr,
  rangeText,
  refsIn,
  shiftFormula,
  upperFormula,
  usesFunction,
  type Pos,
} from "@/lib/excel-formula";
import type { Exercise } from "@/lib/excel-lessons";
import { supabase, useUser } from "@/lib/supabase";
import { Icon, Tip } from "./ui";

/* Ukuran tetap agar sorotan (seleksi, referensi, salin) bisa diletakkan tepat di atas grid. */
const COL_W = 108;
const ROW_H = 34;
const HEAD_W = 40;
const HEAD_H = 28;
const EXTRA_ROWS = 3; // baris kosong untuk coret-coret
const MAX_COLS = 8;
const REF_COLORS = ["#2f6fde", "#e8590c", "#2b8a3e", "#9c36b5", "#c2255c"];

type Grid = string[][];
type Rect = { r0: number; c0: number; r1: number; c1: number };
type Edit = { pos: Pos; draft: string; mode: "enter" | "edit"; source: "cell" | "bar" };
type Point = { start: number; end: number; anchor: Pos; head: Pos };

const rectOf = (a: Pos, b: Pos): Rect => ({ r0: Math.min(a.r, b.r), c0: Math.min(a.c, b.c), r1: Math.max(a.r, b.r), c1: Math.max(a.c, b.c) });
const inRect = (x: Rect, r: number, c: number) => r >= x.r0 && r <= x.r1 && c >= x.c0 && c <= x.c1;
const samePos = (a: Pos, b: Pos) => a.r === b.r && a.c === b.c;
const setCell = (g: Grid, p: Pos, v: string) => g.map((row, i) => (i === p.r ? row.map((x, j) => (j === p.c ? v : x)) : row));
const box = (x: Rect) => ({
  left: HEAD_W + 1 + x.c0 * (COL_W + 1),
  top: HEAD_H + 1 + x.r0 * (ROW_H + 1),
  width: (x.c1 - x.c0 + 1) * (COL_W + 1) - 1,
  height: (x.r1 - x.r0 + 1) * (ROW_H + 1) - 1,
});
const ARROWS: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

function toInput(raw: string): string | number {
  if (raw.startsWith("=")) return normalizeFormula(raw);
  if (raw.startsWith("'")) return raw; // teks angka (NIP); HyperFormula membuang tanda '
  const n = Number(raw);
  return raw.trim() !== "" && !Number.isNaN(n) ? n : raw;
}

function evaluate(grid: Grid): CellValue[][] {
  const hf = HyperFormula.buildFromArray(grid.map((row) => row.map(toInput)), { licenseKey: "gpl-v3" });
  try {
    return hf.getSheetValues(0);
  } finally {
    hf.destroy();
  }
}

function serialToDate(n: number) {
  const d = new Date(Date.UTC(1899, 11, 30) + n * 86_400_000);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

const isErr = (v: CellValue | undefined) => typeof v === "object" && v !== null && "value" in v;

function show(v: CellValue | undefined, isDate: boolean): string {
  if (v === null || v === undefined) return "";
  if (isErr(v)) return String((v as { value: string }).value); // #VALUE!, #NAME?, …
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  // seperti format General Excel: 2015, bukan 2.015
  if (typeof v === "number") return isDate ? serialToDate(v) : v.toLocaleString("id-ID", { maximumFractionDigits: 6, useGrouping: false });
  return String(v);
}

const same = (a: CellValue | undefined, b: CellValue | undefined) =>
  typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 1e-9 : String(a ?? "") === String(b ?? "") && !isErr(a);

const cellAt = (x: number, y: number): Pos | null => {
  const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-r]");
  return el ? { r: Number(el.dataset.r), c: Number(el.dataset.c) } : null;
};

export function ExcelLab({ ex }: { ex: Exercise }) {
  const user = useUser();
  const width = Math.max(...ex.grid.map((r) => r.length));
  const cols = Math.min(MAX_COLS, width + 1);
  const seed = useMemo<Grid>(
    () => [...ex.grid, ...Array.from({ length: EXTRA_ROWS }, () => [] as string[])].map((r) => Array.from({ length: cols }, (_, c) => r[c] ?? "")),
    [ex, cols],
  );
  const rows = seed.length;
  const targetSet = useMemo(() => new Set(ex.targets.map((t) => t.cell)), [ex]);
  const dateSet = useMemo(() => new Set(ex.dateCells ?? []), [ex]);
  const editable = (p: Pos) => targetSet.has(addr(p)) || seed[p.r][p.c] === "";
  const first = parseAddr(ex.targets[0].cell);

  const [cells, setCells] = useState<Grid>(seed);
  const cellsRef = useRef(cells); // nilai terbaru untuk handler yang jalan sebelum render ulang
  const history = useRef<{ past: Grid[]; future: Grid[] }>({ past: [], future: [] });
  const [anchor, setAnchor] = useState<Pos>(first);
  const [head, setHead] = useState<Pos>(first);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [point, setPoint] = useState<Point | null>(null);
  const [caretPos, setCaretPos] = useState(0);
  const [sugIdx, setSugIdx] = useState(0);
  const [sugOff, setSugOff] = useState<string | null>(null);
  const [clip, setClip] = useState<{ rect: Rect; data: Grid; text: string; cut: boolean } | null>(null);
  const [fill, setFill] = useState<{ from: Pos; to: Pos } | null>(null);
  const [notice, setNotice] = useState("");
  const [graded, setGraded] = useState(false);
  const [hint, setHint] = useState(0);
  const [check, setCheck] = useState<{ ok: Record<string, boolean>; missing: string[]; score: number; saved: boolean } | null>(null);
  const [shake, setShake] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);
  const cellInput = useRef<HTMLInputElement>(null);
  const barInput = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const drag = useRef<null | "select" | "point" | "fill">(null);
  const noticeTimer = useRef(0);

  const values = useMemo(() => evaluate(cells), [cells]);
  const expected = useMemo(() => {
    let g = seed;
    for (const t of ex.targets) g = setCell(g, parseAddr(t.cell), t.solution);
    return evaluate(g);
  }, [seed, ex]);

  const sel = rectOf(anchor, head);
  const clamp = (p: Pos): Pos => ({ r: Math.max(0, Math.min(rows - 1, p.r)), c: Math.max(0, Math.min(cols - 1, p.c)) });
  const select = (a: Pos, h: Pos = a) => {
    setAnchor(a);
    setHead(h);
  };
  const focusGrid = () => gridRef.current?.focus({ preventScroll: true });
  const flash = (msg: string) => {
    setNotice(msg);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 2800);
  };
  const inputEl = () => (edit?.source === "bar" ? barInput.current : cellInput.current);

  /* ---------- riwayat (Ctrl+Z / Ctrl+Y) ---------- */
  const write = (next: Grid) => {
    const h = history.current;
    h.past.push(cellsRef.current);
    if (h.past.length > 100) h.past.shift();
    h.future = [];
    cellsRef.current = next;
    setCells(next);
    setCheck(null);
  };
  const travel = (from: Grid[], to: Grid[]) => {
    const g = from.pop();
    if (!g) return;
    to.push(cellsRef.current);
    cellsRef.current = g;
    setCells(g);
    setCheck(null);
  };
  const undo = () => travel(history.current.past, history.current.future);
  const redo = () => travel(history.current.future, history.current.past);

  /* ---------- menyunting sel ---------- */
  const startEdit = (pos: Pos, initial: string | undefined, mode: Edit["mode"], source: Edit["source"] = "cell") => {
    if (!editable(pos)) {
      flash(`${addr(pos)} berisi data soal dan terkunci.`);
      return;
    }
    const draft = initial ?? cellsRef.current[pos.r][pos.c];
    select(pos);
    setEdit({ pos, draft, mode, source });
    setPoint(null);
    setClip(null);
    setSugOff(null);
    setSugIdx(0);
    pendingCaret.current = draft.length;
    setCaretPos(draft.length);
  };

  const commit = (dr = 0, dc = 0, refocus = true) => {
    if (!edit) return;
    const v = upperFormula(edit.draft);
    if (v !== cellsRef.current[edit.pos.r][edit.pos.c]) write(setCell(cellsRef.current, edit.pos, v));
    setEdit(null);
    setPoint(null);
    select(clamp({ r: edit.pos.r + dr, c: edit.pos.c + dc }));
    if (refocus) focusGrid();
  };
  const cancel = () => {
    setEdit(null);
    setPoint(null);
    focusGrid();
  };

  // kursor teks dipasang setelah render (mis. setelah alamat sel disisipkan)
  useLayoutEffect(() => {
    if (pendingCaret.current === null || !edit) return;
    const el = inputEl();
    if (el) {
      el.focus({ preventScroll: true });
      el.setSelectionRange(pendingCaret.current, pendingCaret.current);
    }
    pendingCaret.current = null;
  });

  const onDraft = (e: ChangeEvent<HTMLInputElement>) => {
    const draft = e.target.value;
    setEdit((ed) => ed && { ...ed, draft });
    setPoint(null);
    setCaretPos(e.target.selectionStart ?? draft.length);
    setSugIdx(0);
  };

  const before = edit ? edit.draft.slice(0, caretPos) : "";
  const pointable = !!edit && edit.draft.startsWith("=") && (!!point || canInsertRef(before));

  /** Sisipkan/ganti alamat sel di rumus — inti "klik sel saat menulis rumus". */
  const placeRef = (target: Pos, keepAnchor: boolean) => {
    if (!edit) return;
    const el = inputEl();
    let start: number;
    let end: number;
    let a = target;
    if (point) {
      start = point.start;
      end = point.end;
      if (keepAnchor) a = point.anchor;
    } else {
      start = el?.selectionStart ?? caretPos;
      end = el?.selectionEnd ?? start;
    }
    const text = rangeText(a, target);
    setEdit({ ...edit, draft: edit.draft.slice(0, start) + text + edit.draft.slice(end) });
    setPoint({ start, end: start + text.length, anchor: a, head: target });
    pendingCaret.current = start + text.length;
    setCaretPos(start + text.length);
  };

  /* ---------- saran fungsi & petunjuk argumen ---------- */
  const prefix = edit ? fnPrefix(before) : null;
  const sugs = prefix && prefix !== sugOff ? FUNCTION_NAMES.filter((n) => n.startsWith(prefix.toUpperCase()))
          .sort((a, b) => a.length - b.length || a.localeCompare(b)) // nama terpendek dulu: "su" → SUM, bukan SUBSTITUTE
          .slice(0, 6) : [];
  const fnHint = edit ? currentFunction(before) : null;
  const accept = (name: string) => {
    if (!edit || !prefix) return;
    const start = caretPos - prefix.length;
    setEdit({ ...edit, draft: edit.draft.slice(0, start) + name + "(" + edit.draft.slice(caretPos) });
    setPoint(null);
    pendingCaret.current = start + name.length + 1;
    setCaretPos(start + name.length + 1);
  };

  /* ---------- isi otomatis (fill handle) ---------- */
  const fillRect = (f: { from: Pos; to: Pos }) =>
    Math.abs(f.to.r - f.from.r) >= Math.abs(f.to.c - f.from.c) ? rectOf(f.from, { r: f.to.r, c: f.from.c }) : rectOf(f.from, { r: f.from.r, c: f.to.c });

  const fillFrom = (src: Pos, target: Rect) => {
    let g = cellsRef.current;
    let skipped = 0;
    for (let r = target.r0; r <= target.r1; r++)
      for (let c = target.c0; c <= target.c1; c++) {
        if (r === src.r && c === src.c) continue;
        if (!editable({ r, c })) {
          skipped++;
          continue;
        }
        g = setCell(g, { r, c }, shiftFormula(cellsRef.current[src.r][src.c], r - src.r, c - src.c));
      }
    if (g !== cellsRef.current) write(g);
    if (skipped) flash(`${skipped} sel terkunci dilewati.`);
  };

  const applyFill = () => {
    if (!fill) return;
    const t = fillRect(fill);
    fillFrom(fill.from, t);
    select(fill.from, { r: t.r0 === fill.from.r ? t.r1 : t.r0, c: t.c0 === fill.from.c ? t.c1 : t.c0 });
    setFill(null);
    focusGrid();
  };

  /** Ctrl+D: isi ke bawah dari baris teratas seleksi (atau dari sel di atasnya bila satu baris). */
  const fillDown = () => {
    if (sel.r0 === sel.r1) {
      if (sel.r0 === 0) return;
      for (let c = sel.c0; c <= sel.c1; c++) fillFrom({ r: sel.r0 - 1, c }, { r0: sel.r0 - 1, c0: c, r1: sel.r0, c1: c });
    } else for (let c = sel.c0; c <= sel.c1; c++) fillFrom({ r: sel.r0, c }, { r0: sel.r0, c0: c, r1: sel.r1, c1: c });
  };

  const clearSel = () => {
    let g = cellsRef.current;
    let locked = 0;
    for (let r = sel.r0; r <= sel.r1; r++)
      for (let c = sel.c0; c <= sel.c1; c++) {
        if (editable({ r, c })) g = setCell(g, { r, c }, "");
        else locked++;
      }
    if (g !== cellsRef.current) write(g);
    else if (locked) flash("Sel data soal tidak bisa dihapus.");
  };

  /* ---------- tetikus ---------- */
  const onCellDown = (e: PointerEvent, p: Pos) => {
    if (e.button !== 0 || (e.target as HTMLElement).tagName === "INPUT") return;
    e.preventDefault(); // jaga fokus kotak edit dan cegah seleksi teks
    const mouse = e.pointerType === "mouse";
    if (edit && pointable) {
      placeRef(p, e.shiftKey && !!point);
      drag.current = mouse ? "point" : null;
      return;
    }
    if (edit) commit(0, 0);
    else if (!mouse && samePos(p, anchor) && samePos(p, head)) return startEdit(p, undefined, "edit"); // ketuk sel aktif = sunting (layar sentuh)
    if (e.shiftKey) setHead(p);
    else select(p);
    drag.current = mouse ? "select" : null;
    focusGrid();
  };

  const onFillDown = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    drag.current = "fill";
    setFill({ from: anchor, to: anchor });
  };

  // handler terbaru disimpan di ref agar listener window tidak memakai state basi
  const onMove = useRef<(p: Pos) => void>(() => {});
  onMove.current = (p) => {
    if (drag.current === "select") setHead(p);
    else if (drag.current === "point" && !(point && samePos(point.head, p))) placeRef(p, true);
    else if (drag.current === "fill" && fill && !samePos(fill.to, p)) setFill({ ...fill, to: p });
  };
  const onUp = useRef<() => void>(() => {});
  onUp.current = () => {
    if (drag.current === "fill") applyFill();
    drag.current = null;
  };
  useEffect(() => {
    const move = (e: globalThis.PointerEvent) => {
      if (!drag.current) return;
      const p = cellAt(e.clientX, e.clientY);
      if (p) onMove.current(p);
    };
    const up = () => drag.current && onUp.current();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  /* ---------- keyboard ---------- */
  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (edit || e.target !== gridRef.current) return;
    const k = e.key;
    if (e.ctrlKey || e.metaKey) {
      const l = k.toLowerCase();
      if (l === "z") (e.preventDefault(), e.shiftKey ? redo() : undo());
      else if (l === "y") (e.preventDefault(), redo());
      else if (l === "d") (e.preventDefault(), fillDown());
      else if (l === "a") (e.preventDefault(), select({ r: 0, c: 0 }, { r: rows - 1, c: cols - 1 }));
      else if (ARROWS[k]) {
        e.preventDefault();
        const [dr, dc] = ARROWS[k];
        const to = clamp({ r: dr ? (dr < 0 ? 0 : rows - 1) : head.r, c: dc ? (dc < 0 ? 0 : cols - 1) : head.c });
        if (e.shiftKey) setHead(to);
        else select(to);
      }
      return; // Ctrl+C/X/V diteruskan ke event copy/cut/paste
    }
    if (ARROWS[k]) {
      e.preventDefault();
      const [dr, dc] = ARROWS[k];
      if (e.shiftKey) setHead(clamp({ r: head.r + dr, c: head.c + dc }));
      else select(clamp({ r: anchor.r + dr, c: anchor.c + dc }));
    } else if (k === "Enter") {
      e.preventDefault();
      if (e.altKey) startEdit(anchor, undefined, "edit");
      else select(clamp({ r: anchor.r + (e.shiftKey ? -1 : 1), c: anchor.c }));
    } else if (k === "Tab") {
      const c = anchor.c + (e.shiftKey ? -1 : 1);
      if (c < 0 || c >= cols) return; // biarkan Tab keluar dari grid di tepi
      e.preventDefault();
      select({ r: anchor.r, c });
    } else if (k === "F2") {
      e.preventDefault();
      startEdit(anchor, undefined, "edit");
    } else if (k === "Delete" || k === "Backspace") {
      e.preventDefault();
      clearSel();
    } else if (k === "Escape") {
      setClip(null);
      select(anchor);
    } else if (k.length === 1 && !e.altKey) {
      e.preventDefault();
      startEdit(anchor, k, "enter"); // mengetik langsung menimpa isi sel, seperti Excel
    }
  };

  const onEditKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!edit) return;
    const k = e.key;
    if (sugs.length) {
      if (k === "ArrowDown" || k === "ArrowUp") {
        e.preventDefault();
        setSugIdx((i) => (i + (k === "ArrowDown" ? 1 : sugs.length - 1)) % sugs.length);
        return;
      }
      if (k === "Tab") {
        e.preventDefault();
        accept(sugs[Math.min(sugIdx, sugs.length - 1)]);
        return;
      }
      if (k === "Escape") {
        e.preventDefault();
        setSugOff(prefix);
        return;
      }
    }
    if (k === "Enter") (e.preventDefault(), commit(e.shiftKey ? -1 : 1, 0));
    else if (k === "Tab") (e.preventDefault(), commit(0, e.shiftKey ? -1 : 1));
    else if (k === "Escape") (e.preventDefault(), cancel());
    else if (k === "F2") (e.preventDefault(), setEdit({ ...edit, mode: edit.mode === "enter" ? "edit" : "enter" }));
    else if (ARROWS[k] && !e.ctrlKey && !e.metaKey && edit.mode === "enter") {
      const [dr, dc] = ARROWS[k];
      const b = edit.draft.slice(0, e.currentTarget.selectionStart ?? edit.draft.length);
      if (edit.draft.startsWith("=") && (point || canInsertRef(b))) {
        e.preventDefault(); // mode Tunjuk: panah memilih sel untuk rumus
        const base = point ? point.head : edit.pos;
        placeRef(clamp({ r: base.r + dr, c: base.c + dc }), e.shiftKey && !!point);
      } else if (edit.source === "cell") {
        e.preventDefault();
        commit(dr, dc);
      }
    } else if (!ARROWS[k] && !["Shift", "Control", "Alt", "Meta"].includes(k)) setPoint(null);
  };

  const onEditBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const to = e.relatedTarget as Node | null;
    if (to && (to === gridRef.current || to === cellInput.current || to === barInput.current)) return;
    commit(0, 0, false); // klik di luar lembar kerja (mis. tombol Cek) menyimpan isi
  };

  const trackCaret = (e: React.SyntheticEvent<HTMLInputElement>) => setCaretPos(e.currentTarget.selectionStart ?? 0);

  /* ---------- salin / potong / tempel ---------- */
  const onCopy = (e: ClipboardEvent<HTMLDivElement>, cut = false) => {
    if (edit) return;
    e.preventDefault();
    const data = cellsRef.current.slice(sel.r0, sel.r1 + 1).map((row) => row.slice(sel.c0, sel.c1 + 1));
    const text = data.map((row) => row.join("\t")).join("\n");
    e.clipboardData.setData("text/plain", text);
    setClip({ rect: sel, data, text, cut });
    flash(cut ? "Dipotong. Pilih tujuan lalu Ctrl+V." : "Disalin. Pilih tujuan lalu Ctrl+V.");
  };

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    if (edit) return;
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const own = clip && clip.text === text ? clip : null;
    const data: Grid = own ? own.data : text.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((l) => l.split("\t"));
    let g = cellsRef.current;
    if (own?.cut)
      for (let r = own.rect.r0; r <= own.rect.r1; r++) for (let c = own.rect.c0; c <= own.rect.c1; c++) if (editable({ r, c })) g = setCell(g, { r, c }, "");
    // satu sel disalin ke seleksi lebih besar = isi semua sel terpilih, seperti Excel
    const single = data.length === 1 && data[0].length === 1;
    const area = single ? sel : { r0: sel.r0, c0: sel.c0, r1: sel.r0 + data.length - 1, c1: sel.c0 + Math.max(...data.map((d) => d.length)) - 1 };
    let skipped = 0;
    for (let r = area.r0; r <= Math.min(area.r1, rows - 1); r++)
      for (let c = area.c0; c <= Math.min(area.c1, cols - 1); c++) {
        const v = single ? data[0][0] : data[r - area.r0]?.[c - area.c0];
        if (v === undefined) continue;
        if (!editable({ r, c })) {
          skipped++;
          continue;
        }
        const src = own ? { r: own.rect.r0 + (single ? 0 : r - area.r0), c: own.rect.c0 + (single ? 0 : c - area.c0) } : null;
        g = setCell(g, { r, c }, src && !own!.cut ? shiftFormula(v, r - src.r, c - src.c) : v);
      }
    if (g !== cellsRef.current) write(g);
    select({ r: area.r0, c: area.c0 }, clamp({ r: area.r1, c: area.c1 }));
    if (own?.cut) setClip(null);
    if (skipped) flash(`${skipped} sel terkunci dilewati.`);
  };

  /* ---------- penilaian ---------- */
  const runCheck = async () => {
    const now = evaluate(cellsRef.current);
    const ok: Record<string, boolean> = {};
    for (const t of ex.targets) {
      const { r, c } = parseAddr(t.cell);
      ok[t.cell] = same(now[r]?.[c], expected[r]?.[c]);
    }
    const formulas = Object.fromEntries(ex.targets.map((t) => [t.cell, cellsRef.current[parseAddr(t.cell).r][parseAddr(t.cell).c]]));
    const missing = ex.required.filter((fn) => !Object.values(formulas).some((f) => usesFunction(f, fn)));
    const passed = Object.values(ok).filter(Boolean).length + (ex.required.length - missing.length);
    const score = Math.round((passed / (ex.targets.length + ex.required.length)) * 100);
    let saved = false;
    if (graded && user) await saveExcel(ex.id, formulas, score).then(() => (saved = true)).catch(() => {});
    setCheck({ ok, missing, score, saved });
    if (score < 100) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  };

  /* ---------- tampilan ---------- */
  const refs = edit ? refsIn(edit.draft) : [];
  const status = edit ? (point ? "Tunjuk" : edit.mode === "enter" ? "Masukkan" : "Edit") : "Siap";
  const nums: number[] = [];
  if (!edit && (sel.r0 !== sel.r1 || sel.c0 !== sel.c1))
    for (let r = sel.r0; r <= sel.r1; r++) for (let c = sel.c0; c <= sel.c1; c++) if (typeof values[r]?.[c] === "number") nums.push(values[r][c] as number);
  const activeRaw = cells[anchor.r][anchor.c];
  const showHandle = !edit && sel.r0 === sel.r1 && sel.c0 === sel.c1 && editable(anchor);
  const assist = edit && (sugs.length > 0 || (fnHint && FUNCTIONS[fnHint.name])) && (
    <div className="absolute top-full left-0 z-40 mt-1 w-max max-w-[min(420px,85vw)] border border-line bg-bg text-[13px] shadow-[0_10px_28px_-14px_rgb(30_42_47/0.3)]" role="listbox" aria-label="Saran fungsi">
      {sugs.length > 0 ? (
        sugs.map((n, i) => (
          <button
            key={n}
            type="button"
            role="option"
            aria-selected={i === sugIdx}
            onPointerDown={(e) => (e.preventDefault(), accept(n))}
            className={`flex w-full items-baseline gap-3 px-3 py-1.5 text-left ${i === sugIdx ? "bg-accent text-on-accent" : "hover:bg-surface"}`}
          >
            <span className="font-mono font-medium">{n}</span>
            <span className={i === sugIdx ? "" : "text-muted"}>{FUNCTIONS[n].desc}</span>
          </button>
        ))
      ) : (
        <p className="px-3 py-2 font-mono">
          {fnHint!.name}(
          {FUNCTIONS[fnHint!.name].args.map((a, i, all) => {
            const cur = i === Math.min(fnHint!.arg, all.length - 1) || (all[all.length - 1] === "…" && fnHint!.arg >= all.length - 1 && i === all.length - 2);
            return (
              <span key={i}>
                <span className={cur ? "font-semibold text-fg underline decoration-accent decoration-2 underline-offset-2" : "text-muted"}>{a}</span>
                {i < all.length - 1 ? "; " : ""}
              </span>
            );
          })}
          )
        </p>
      )}
      {sugs.length > 0 && <p className="border-t border-line px-3 py-1 text-[11px] text-muted">Tab untuk memilih · Esc tutup</p>}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-[16px] leading-[1.55]">{ex.prompt}</p>
        <Tip label="Mati: cek benar/salah saja, tidak disimpan. Nyala: skor disimpan ke riwayat Anda.">
          <label className="flex shrink-0 cursor-pointer items-center gap-3 text-[14px] font-medium select-none">
            <input type="checkbox" className="peer sr-only" checked={graded} onChange={(e) => setGraded(e.target.checked)} />
            <span className="relative h-6 w-11 rounded-full border border-line bg-surface transition-colors peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
              <span className={`absolute top-0.5 size-[18px] rounded-full bg-fg transition-transform duration-300 ${graded ? "translate-x-[22px]" : "translate-x-0.5"}`} />
            </span>
            Nilai pekerjaan saya
          </label>
        </Tip>
      </div>

      <div className={`border border-line ${shake ? "anim-shake" : ""}`}>
        {/* Kotak Nama + bilah rumus */}
        <div className="relative flex items-stretch border-b border-line bg-surface text-[14px]">
          <div className="flex w-16 shrink-0 items-center justify-center border-r border-line font-mono text-[13px] font-medium md:w-20" aria-label="Kotak Nama">
            {sel.r0 !== sel.r1 || sel.c0 !== sel.c1 ? rangeText(anchor, head) : addr(anchor)}
          </div>
          <span className="flex items-center border-r border-line px-2.5 font-serif text-[15px] text-muted italic" aria-hidden>
            fx
          </span>
          <div className="relative min-w-0 flex-1">
            <input
              ref={barInput}
              aria-label="Bilah rumus"
              value={edit ? edit.draft : activeRaw}
              readOnly={!edit && !editable(anchor)}
              spellCheck={false}
              autoComplete="off"
              onFocus={() => {
                if (!edit) startEdit(anchor, undefined, "edit", "bar");
                else if (edit.source === "cell") setEdit({ ...edit, source: "bar" });
              }}
              onChange={onDraft}
              onKeyDown={onEditKey}
              onSelect={trackCaret}
              onMouseUp={() => setPoint(null)}
              onBlur={onEditBlur}
              className="h-9 w-full bg-bg px-2.5 font-mono select-text text-[13px] outline-none read-only:text-muted focus:bg-bg"
            />
            {edit?.source === "bar" && assist}
          </div>
          {!editable(anchor) && !edit && <span className="hidden items-center px-3 text-[12px] text-muted sm:flex">Data soal · terkunci</span>}
        </div>

        <div className="overflow-x-auto">
          <div
            ref={gridRef}
            role="grid"
            aria-label="Lembar kerja latihan"
            aria-activedescendant={`${ex.id}-${addr(anchor)}`}
            tabIndex={0}
            onKeyDown={onGridKey}
            onCopy={onCopy}
            onCut={(e) => onCopy(e, true)}
            onPaste={onPaste}
            className="relative grid w-max gap-px bg-line text-[14px] outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
            style={{ gridTemplateColumns: `${HEAD_W}px repeat(${cols}, ${COL_W}px)`, gridTemplateRows: `${HEAD_H}px repeat(${rows}, ${ROW_H}px)` }}
          >
            <div className="bg-surface" />
            {Array.from({ length: cols }, (_, c) => (
              <div key={c} className={`flex items-center justify-center text-[12px] font-medium transition-colors ${c >= sel.c0 && c <= sel.c1 ? "bg-accent/25 text-fg" : "bg-surface text-muted"}`}>
                {colName(c)}
              </div>
            ))}
            {cells.map((row, r) => (
              <div key={r} role="row" className="contents">
                <div className={`flex items-center justify-center text-[12px] transition-colors ${r >= sel.r0 && r <= sel.r1 ? "bg-accent/25 text-fg" : "bg-surface text-muted"}`}>{r + 1}</div>
                {row.map((raw, c) => {
                  const p = { r, c };
                  const a = addr(p);
                  const v = values[r]?.[c];
                  const isTarget = targetSet.has(a);
                  const locked = !editable(p);
                  const res = check?.ok[a];
                  const editingHere = edit && samePos(edit.pos, p);
                  return (
                    <div
                      key={c}
                      id={`${ex.id}-${a}`}
                      role="gridcell"
                      aria-selected={inRect(sel, r, c)}
                      aria-readonly={locked}
                      aria-label={`${a}${raw.startsWith("=") ? `, rumus ${raw}` : ""}, ${show(v, dateSet.has(a)) || "kosong"}`}
                      data-r={r}
                      data-c={c}
                      onPointerDown={(e) => onCellDown(e, p)}
                      onDoubleClick={() => !edit && startEdit(p, undefined, "edit")}
                      className={`relative flex items-center px-2 ${
                        res === true ? "bg-accent/30" : res === false ? "bg-danger/15" : isTarget ? "bg-accent/12" : r < ex.grid.length ? "bg-bg" : "bg-bg/70"
                      } ${locked ? "text-muted" : ""} ${r === 0 && r < ex.grid.length ? "font-semibold" : ""} ${pointable ? "cursor-cell" : "cursor-default"}`}
                    >
                      {editingHere && edit.source === "cell" ? (
                        <>
                          <input
                            ref={cellInput}
                            aria-label={`Sunting ${a}`}
                            value={edit.draft}
                            spellCheck={false}
                            autoComplete="off"
                            onChange={onDraft}
                            onKeyDown={onEditKey}
                            onSelect={trackCaret}
                            onMouseUp={() => setPoint(null)}
                            onBlur={onEditBlur}
                            className="absolute inset-y-0 left-0 z-30 bg-bg px-2 font-mono select-text text-[13px] text-fg outline-2 outline-accent"
                            style={{ width: `max(100%, ${edit.draft.length + 3}ch)` }}
                          />
                          {assist}
                        </>
                      ) : (
                        <span
                          className={`w-full truncate ${editingHere ? "font-mono text-[13px]" : ""} ${
                            !editingHere && (typeof v === "number" || typeof v === "boolean") ? "text-right tabular-nums" : ""
                          } ${!editingHere && isErr(v) ? "text-danger" : ""}`}
                        >
                          {editingHere ? edit.draft : show(v, dateSet.has(a))}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Sorotan di atas grid */}
            {refs.map((x, i) => (
              <div
                key={`${x.start}-${x.text}`}
                aria-hidden
                className="pointer-events-none absolute z-10"
                style={{ ...box({ r0: x.from.r, c0: x.from.c, r1: Math.min(x.to.r, rows - 1), c1: Math.min(x.to.c, cols - 1) }), outline: `2px solid ${REF_COLORS[i % REF_COLORS.length]}`, outlineOffset: -1, background: `${REF_COLORS[i % REF_COLORS.length]}1a` }}
              />
            ))}
            {clip && <div aria-hidden className="ants pointer-events-none absolute z-10" style={box(clip.rect)} />}
            {fill && <div aria-hidden className="pointer-events-none absolute z-10 outline-2 -outline-offset-1 outline-fg outline-dashed" style={box(fillRect(fill))} />}
            {!edit && (
              <div aria-hidden className="pointer-events-none absolute z-20 bg-accent/10 outline-2 -outline-offset-1 outline-accent transition-all duration-100" style={box(sel)}>
                {showHandle && (
                  <span
                    onPointerDown={onFillDown}
                    title="Tarik untuk mengisi"
                    className="pointer-events-auto absolute -right-[5px] -bottom-[5px] size-[9px] cursor-crosshair border border-bg bg-accent touch-none"
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bilah status ala Excel */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line bg-surface px-3 py-1.5 text-[12px] text-muted" aria-live="polite">
          <span>
            <span className="font-medium text-fg">{status}</span>
            {notice ? ` · ${notice}` : ""}
          </span>
          {nums.length > 0 && (
            <span className="tabular-nums">
              Rata-rata: {show(nums.reduce((s, n) => s + n, 0) / nums.length, false)} · Hitung: {nums.length} · Jumlah: {show(nums.reduce((s, n) => s + n, 0), false)}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-[13px] text-muted">
        <p>
          Klik sel lalu ketik untuk mengisi; Enter menyimpan. Saat menulis rumus, <strong className="font-medium text-fg">klik atau seret sel</strong> untuk memasukkan
          alamatnya. Tarik kotak kuning kecil di pojok sel untuk mengisi ke bawah. Sel kuning muda adalah target.
        </p>
        <details className="group">
          <summary className="link w-max cursor-pointer select-none hover:text-fg">Pintasan keyboard</summary>
          <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {[
              ["Panah", "pindah sel (Shift = perluas seleksi)"],
              ["Ketik / F2 / klik ganda", "mulai menyunting sel"],
              ["Enter / Tab", "simpan, lalu turun / ke kanan"],
              ["Esc", "batalkan suntingan"],
              ["Panah saat menulis rumus", "pilih sel untuk rumus (mode Tunjuk)"],
              ["Tab saat saran muncul", "pakai nama fungsi"],
              ["Ctrl+C / Ctrl+X / Ctrl+V", "salin, potong, tempel"],
              ["Ctrl+D", "isi ke bawah"],
              ["Ctrl+Z / Ctrl+Y", "urungkan / ulangi"],
              ["Delete", "kosongkan sel terpilih"],
            ].map(([k, d]) => (
              <li key={k}>
                <kbd className="font-mono text-fg">{k}</kbd> — {d}
              </li>
            ))}
          </ul>
        </details>
        <p>Pemisah argumen , dan ; sama-sama diterima. Diuji pada mesin web (HyperFormula), hasil bisa sedikit berbeda dari Excel asli.</p>
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <button type="button" onClick={runCheck} className="btn btn-primary justify-between">
          {graded ? "Nilai pekerjaan" : "Cek jawaban"} <Icon.Arrow />
        </button>
        <button type="button" onClick={() => setHint((h) => Math.min(3, h + 1))} disabled={hint >= 3} className="btn btn-secondary justify-between">
          {["Petunjuk 1", "Petunjuk 2", "Tampilkan jawaban", "Jawaban ditampilkan"][hint]}
        </button>
        <button type="button" onClick={undo} className="link text-[14px] text-muted hover:text-fg sm:ml-auto">
          Urungkan
        </button>
        <button
          type="button"
          onClick={() => {
            setEdit(null);
            setClip(null);
            write(seed);
          }}
          className="link text-[14px] text-muted hover:text-fg"
        >
          Reset grid
        </button>
      </div>

      {hint > 0 && (
        <div className="anim-fade-up card flex flex-col gap-2 p-4 text-[15px]">
          <p>
            <span className="eyebrow mr-2">Petunjuk 1</span>
            {ex.hints[0]}
          </p>
          {hint > 1 && (
            <p className="anim-fade-up">
              <span className="eyebrow mr-2">Petunjuk 2</span>
              {ex.hints[1]}
            </p>
          )}
          {hint > 2 && (
            <ul className="anim-fade-up font-mono text-[13px]">
              {ex.targets.map((t) => (
                <li key={t.cell}>
                  {t.cell}: {t.solution}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {check && (
        <div className={`anim-fade-up p-4 ${check.score === 100 ? "anim-pop bg-accent text-on-accent" : "border border-line"}`} role="status">
          <p className="font-display text-[28px] tracking-[-0.02em]">{check.score}%</p>
          <p className="mt-1 text-[14px]">
            {Object.values(check.ok).filter(Boolean).length}/{ex.targets.length} sel benar.
            {check.missing.length ? ` Wajib memakai: ${check.missing.join(", ")}.` : ""}
          </p>
          <p className="mt-1 text-[13px] opacity-80">
            {graded ? (check.saved ? "Skor tersimpan." : !supabase ? "Mode demo: skor tidak disimpan." : user ? "Skor gagal disimpan." : "Masuk agar skor tersimpan.") : "Mode latihan bebas: tidak disimpan."}
          </p>
        </div>
      )}
    </div>
  );
}
