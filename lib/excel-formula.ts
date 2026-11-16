// F5: Excel lokal Indonesia memakai ";" sebagai pemisah argumen. Ubah ";" di luar string menjadi ",".
// HyperFormula juga memperlakukan TRUE/FALSE sebagai fungsi, jadi FALSE (mis. di VLOOKUP) ditulis ulang jadi FALSE().
// shortcut: koma desimal (mis. 2,5) tidak didukung di dalam rumus — pakai titik. Upgrade bila pengguna sering bingung.
export function normalizeFormula(input: string): string {
  if (!input.startsWith("=")) return input;
  return outsideStrings(input, (part) => part.replace(/;/g, ",").replace(/\b(TRUE|FALSE)\b(?!\s*\()/gi, "$1()"));
}

/** Fungsi wajib (F4) dipakai di rumus? Cocokkan nama fungsi diikuti "(". */
export function usesFunction(formula: string, fn: string): boolean {
  return new RegExp(`\\b${fn}\\s*\\(`, "i").test(formula);
}

/* ---------- Bantuan editor ala Excel ---------- */

export type Pos = { r: number; c: number };

/** Terapkan fn hanya pada bagian rumus di luar "string". */
function outsideStrings(f: string, fn: (part: string) => string) {
  return f
    .split('"')
    .map((part, i) => (i % 2 ? part : fn(part)))
    .join('"');
}

const colIndex = (letters: string) => [...letters.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
export const colName = (c: number): string => (c < 26 ? String.fromCharCode(65 + c) : colName(Math.floor(c / 26) - 1) + String.fromCharCode(65 + (c % 26)));
export const addr = (p: Pos) => `${colName(p.c)}${p.r + 1}`;
export const parseAddr = (a: string): Pos => {
  const m = a.match(/^\$?([A-Z]+)\$?(\d+)$/i)!;
  return { r: Number(m[2]) - 1, c: colIndex(m[1]) };
};

/** "B2" untuk satu sel, "B2:B5" untuk rentang (diurutkan kiri-atas ke kanan-bawah). */
export function rangeText(a: Pos, b: Pos) {
  const tl = { r: Math.min(a.r, b.r), c: Math.min(a.c, b.c) };
  const br = { r: Math.max(a.r, b.r), c: Math.max(a.c, b.c) };
  return tl.r === br.r && tl.c === br.c ? addr(tl) : `${addr(tl)}:${addr(br)}`;
}

// Referensi sel: tidak didahului huruf/angka/titik dan tidak diikuti "(" (agar nama fungsi seperti LOG10 tidak ikut).
const REF = /(?<![A-Za-z0-9_.])(\$?)([A-Za-z]{1,2})(\$?)(\d+)(?![A-Za-z0-9_(])/g;

/** Isi rumus disalin/diisi ke posisi lain: referensi relatif digeser, yang dikunci $ tetap (seperti Excel). */
export function shiftFormula(f: string, dr: number, dc: number): string {
  if (!f.startsWith("=") || (dr === 0 && dc === 0)) return f;
  return outsideStrings(f, (part) =>
    part.replace(REF, (_m, dCol: string, col: string, dRow: string, row: string) => {
      const c = dCol ? colIndex(col) : colIndex(col) + dc;
      const r = dRow ? Number(row) : Number(row) + dr;
      return c < 0 || r < 1 ? "#REF!" : `${dCol}${colName(c)}${dRow}${r}`;
    }),
  );
}

/** Seperti Excel: nama fungsi dan alamat sel ditulis kapital saat rumus disimpan. Isi "string" tidak diubah. */
export const upperFormula = (f: string) => (f.startsWith("=") ? outsideStrings(f, (p) => p.toUpperCase()) : f);

export type RefSpan = { text: string; start: number; end: number; from: Pos; to: Pos };

/** Semua referensi/rentang di rumus beserta posisinya, untuk menyorot sel yang dirujuk. */
export function refsIn(f: string): RefSpan[] {
  if (!f.startsWith("=")) return [];
  const out: RefSpan[] = [];
  const re = /(?<![A-Za-z0-9_.])(\$?[A-Za-z]{1,2}\$?\d+)(?::(\$?[A-Za-z]{1,2}\$?\d+))?(?![A-Za-z0-9_(])/g;
  let inStr = false;
  let offset = 0;
  for (const part of f.split('"')) {
    if (!inStr)
      for (const m of part.matchAll(re)) {
        const a = parseAddr(m[1]);
        const b = m[2] ? parseAddr(m[2]) : a;
        out.push({
          text: m[0],
          start: offset + m.index!,
          end: offset + m.index! + m[0].length,
          from: { r: Math.min(a.r, b.r), c: Math.min(a.c, b.c) },
          to: { r: Math.max(a.r, b.r), c: Math.max(a.c, b.c) },
        });
      }
    offset += part.length + 1;
    inStr = !inStr;
  }
  return out;
}

const inString = (before: string) => (before.split('"').length - 1) % 2 === 1;

/** Boleh memasukkan alamat sel dengan klik? Ya bila sedang menulis rumus dan kursor tepat setelah operator/pemisah. */
export function canInsertRef(before: string): boolean {
  if (!before.startsWith("=") || inString(before)) return false;
  return /[=(,;+\-*/^&<>:]\s*$/.test(before);
}

/** Awalan nama fungsi yang sedang diketik (untuk saran), mis. "=SUM(XL" → "XL". */
export function fnPrefix(before: string): string | null {
  if (!before.startsWith("=") || inString(before)) return null;
  const m = before.match(/(?:^=|[=(,;+\-*/^&<>\s])([A-Za-z][A-Za-z.]*)$/);
  return m ? m[1] : null;
}

/** Fungsi terdalam yang belum ditutup di posisi kursor dan indeks argumennya, untuk petunjuk sintaks. */
export function currentFunction(before: string): { name: string; arg: number } | null {
  if (!before.startsWith("=")) return null;
  const stack: { name: string; arg: number }[] = [];
  let inStr = false;
  for (let i = 0; i < before.length; i++) {
    const ch = before[i];
    if (ch === '"') inStr = !inStr;
    if (inStr) continue;
    if (ch === "(") stack.push({ name: before.slice(0, i).match(/([A-Za-z][A-Za-z0-9.]*)$/)?.[1]?.toUpperCase() ?? "", arg: 0 });
    else if (ch === ")") stack.pop();
    else if ((ch === "," || ch === ";") && stack.length) stack[stack.length - 1].arg++;
  }
  for (let i = stack.length - 1; i >= 0; i--) if (stack[i].name) return stack[i];
  return null;
}
