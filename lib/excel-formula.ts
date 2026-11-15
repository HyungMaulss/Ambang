// F5: Excel lokal Indonesia memakai ";" sebagai pemisah argumen. Ubah ";" di luar string menjadi ",".
// HyperFormula juga memperlakukan TRUE/FALSE sebagai fungsi, jadi FALSE (mis. di VLOOKUP) ditulis ulang jadi FALSE().
// shortcut: koma desimal (mis. 2,5) tidak didukung di dalam rumus — pakai titik. Upgrade bila pengguna sering bingung.
export function normalizeFormula(input: string): string {
  if (!input.startsWith("=")) return input;
  // bagian genap = di luar string, ganjil = isi "string"
  return input
    .split('"')
    .map((part, i) => (i % 2 ? part : part.replace(/;/g, ",").replace(/\b(TRUE|FALSE)\b(?!\s*\()/gi, "$1()")))
    .join('"');
}

/** Fungsi wajib (F4) dipakai di rumus? Cocokkan nama fungsi diikuti "(". */
export function usesFunction(formula: string, fn: string): boolean {
  return new RegExp(`\\b${fn}\\s*\\(`, "i").test(formula);
}
