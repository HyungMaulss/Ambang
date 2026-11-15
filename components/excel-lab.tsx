"use client";

import { HyperFormula, type CellValue } from "hyperformula";
import { useMemo, useState } from "react";
import { saveExcel } from "@/lib/bank";
import { normalizeFormula, usesFunction } from "@/lib/excel-formula";
import type { Exercise } from "@/lib/excel-lessons";
import { supabase, useUser } from "@/lib/supabase";
import { Icon, Tip } from "./ui";

const COLS = "ABCDEFGH";
const addr = (r: number, c: number) => `${COLS[c]}${r + 1}`;
const parseAddr = (a: string) => ({ r: Number(a.slice(1)) - 1, c: COLS.indexOf(a[0]) });

function toInput(raw: string): string | number {
  if (raw.startsWith("=")) return normalizeFormula(raw);
  if (raw.startsWith("'")) return raw; // teks angka (NIP); HyperFormula membuang tanda '
  const n = Number(raw);
  return raw.trim() !== "" && !Number.isNaN(n) ? n : raw;
}

function evaluate(grid: string[][]): CellValue[][] {
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

function show(v: CellValue | undefined, isDate: boolean): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "value" in v) return String(v.value); // DetailedCellError: #VALUE!, #NAME? …
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return isDate ? serialToDate(v) : v.toLocaleString("id-ID", { maximumFractionDigits: 6, useGrouping: false }) // seperti format General Excel: 2015, bukan 2.015;
  return String(v);
}

const same = (a: CellValue | undefined, b: CellValue | undefined) =>
  typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 1e-9 : String(a ?? "") === String(b ?? "") && typeof a !== "object";

export function ExcelLab({ ex }: { ex: Exercise }) {
  const user = useUser();
  const width = Math.max(...ex.grid.map((r) => r.length));
  const seed = useMemo(() => ex.grid.map((r) => [...r, ...Array(width - r.length).fill("")]), [ex, width]);
  const targetSet = useMemo(() => new Set(ex.targets.map((t) => t.cell)), [ex]);
  const [cells, setCells] = useState(seed);
  const [focus, setFocus] = useState<string | null>(null);
  const [graded, setGraded] = useState(false);
  const [hint, setHint] = useState(0);
  const [check, setCheck] = useState<{ ok: Record<string, boolean>; missing: string[]; score: number; saved: boolean } | null>(null);
  const [shake, setShake] = useState(false);

  const values = useMemo(() => evaluate(cells), [cells]);
  const expected = useMemo(() => {
    const g = seed.map((r) => [...r]);
    for (const t of ex.targets) {
      const { r, c } = parseAddr(t.cell);
      g[r][c] = t.solution;
    }
    return evaluate(g);
  }, [seed, ex]);

  const edit = (r: number, c: number, v: string) => {
    setCells((g) => g.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)));
    setCheck(null);
  };

  const runCheck = async () => {
    const ok: Record<string, boolean> = {};
    for (const t of ex.targets) {
      const { r, c } = parseAddr(t.cell);
      ok[t.cell] = same(values[r]?.[c], expected[r]?.[c]);
    }
    const formulas = Object.fromEntries(ex.targets.map((t) => [t.cell, cells[parseAddr(t.cell).r][parseAddr(t.cell).c]]));
    const missing = ex.required.filter((fn) => !Object.values(formulas).some((f) => usesFunction(f, fn)));
    const passed = Object.values(ok).filter(Boolean).length + (ex.required.length - missing.length);
    const score = Math.round((passed / (ex.targets.length + ex.required.length)) * 100);
    let saved = false;
    if (graded && user) {
      await saveExcel(ex.id, formulas, score).then(() => (saved = true)).catch(() => {});
    }
    setCheck({ ok, missing, score, saved });
    if (score < 100) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  };

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

      <div className={`overflow-x-auto rounded-[8px] border border-line ${shake ? "anim-shake" : ""}`}>
        <table className="w-full min-w-[520px] border-collapse text-[14px]">
          <thead>
            <tr className="bg-surface text-[12px] text-muted">
              <th className="w-10 border-r border-b border-line" />
              {Array.from({ length: width }, (_, c) => (
                <th key={c} className="border-r border-b border-line px-2 py-1.5 font-medium last:border-r-0">
                  {COLS[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cells.map((row, r) => (
              <tr key={r}>
                <td className="border-r border-b border-line bg-surface text-center text-[12px] text-muted">{r + 1}</td>
                {row.map((raw, c) => {
                  const a = addr(r, c);
                  const isTarget = targetSet.has(a);
                  const locked = !isTarget && seed[r][c] !== "";
                  const res = check?.ok[a];
                  const display = focus === a ? raw : show(values[r]?.[c], !!ex.dateCells?.includes(a));
                  return (
                    <td key={c} className="border-r border-b border-line p-0 last:border-r-0">
                      <input
                        aria-label={`Sel ${a}`}
                        value={display}
                        readOnly={locked}
                        onFocus={() => setFocus(a)}
                        onBlur={() => setFocus(null)}
                        onChange={(e) => edit(r, c, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (document.querySelector(`[aria-label="Sel ${addr(r + 1, c)}"]`) as HTMLInputElement | null)?.focus();
                        }}
                        className={`w-full min-w-[96px] bg-transparent px-2 py-2 transition-colors outline-none focus:bg-surface focus:ring-2 focus:ring-accent focus:ring-inset ${
                          r === 0 ? "font-medium" : ""
                        } ${locked ? "text-muted" : ""} ${isTarget ? "bg-accent/10" : ""} ${res === true ? "!bg-accent/30" : res === false ? "!bg-danger/15" : ""}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[13px] text-muted">
        Sel kuning adalah target. Klik sel untuk melihat rumusnya. Pemisah argumen <code>,</code> dan <code>;</code> sama-sama diterima. Diuji pada mesin
        web (HyperFormula), hasil bisa sedikit berbeda dari Excel asli.
      </p>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <button type="button" onClick={runCheck} className="btn btn-primary justify-between">
          {graded ? "Nilai pekerjaan" : "Cek jawaban"} <Icon.Arrow />
        </button>
        <button type="button" onClick={() => setHint((h) => Math.min(3, h + 1))} disabled={hint >= 3} className="btn btn-secondary justify-between">
          {["Petunjuk 1", "Petunjuk 2", "Tampilkan jawaban", "Jawaban ditampilkan"][hint]}
        </button>
        <button
          type="button"
          onClick={() => {
            setCells(seed);
            setCheck(null);
          }}
          className="text-[14px] text-muted underline underline-offset-2 transition-colors hover:text-fg sm:ml-auto"
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
        <div className={`anim-fade-up rounded-[8px] p-4 ${check.score === 100 ? "bg-accent text-on-accent anim-pop" : "border border-line"}`} role="status">
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
