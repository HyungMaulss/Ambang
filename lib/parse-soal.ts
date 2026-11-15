// Parser template soal (E1/E3). Murni, tanpa dependensi.
// Format per soal:
//   Soal: <teks>            (boleh "Soal 1:" / "Soal 1.")
//   A. <opsi> … E. <opsi>
//   Kunci: C                (TWK/TIU/psikotes)  ATAU  Bobot: A=3, B=5, C=1, D=2, E=4  (TKP)
//   Pembahasan: <teks>      (opsional)
//   Tulis [gambar] di teks soal bila ada gambar — ditandai untuk diisi manual (E6).

export type ParsedQuestion = {
  body: string;
  options: { label: string; body: string; score: number }[];
  type: "single" | "weighted";
  explanation: string;
  needsImage: boolean;
  errors: string[];
};

const SOAL = /^soal\s*\d*\s*[:.)]\s*/i;
const OPT = /^([A-E])\s*[.)]\s*(.*)$/;
const KUNCI = /^kunci(?:\s+jawaban)?\s*:\s*([A-E])\b/i;
const BOBOT = /^bobot\s*:\s*(.*)$/i;
const BAHAS = /^pembahasan\s*:\s*(.*)$/i;

export function parseSoal(text: string): ParsedQuestion[] {
  const lines = text.replace(/\r/g, "").split("\n").map((l) => l.trim());
  const blocks: string[][] = [];
  for (const line of lines) {
    if (SOAL.test(line)) blocks.push([line.replace(SOAL, "")]);
    else if (blocks.length && line) blocks[blocks.length - 1].push(line);
  }
  return blocks.map(parseBlock);
}

function parseBlock(block: string[]): ParsedQuestion {
  let body = "";
  let explanation = "";
  let key: string | null = null;
  let weights: Record<string, number> | null = null;
  const opts: { label: string; body: string }[] = [];
  let section: "body" | "opt" | "bahas" = "body";

  for (const line of block) {
    let m: RegExpMatchArray | null;
    if ((m = line.match(KUNCI))) {
      key = m[1].toUpperCase();
      section = "opt";
    } else if ((m = line.match(BOBOT))) {
      weights = {};
      for (const [, l, v] of m[1].matchAll(/([A-E])\s*[=:]\s*([1-5])/gi)) weights[l.toUpperCase()] = Number(v);
      section = "opt";
    } else if ((m = line.match(BAHAS))) {
      explanation = m[1];
      section = "bahas";
    } else if (section !== "bahas" && (m = line.match(OPT))) {
      opts.push({ label: m[1].toUpperCase(), body: m[2] });
      section = "opt";
    } else if (section === "body") body += (body ? "\n" : "") + line;
    else if (section === "bahas") explanation += " " + line;
    else if (opts.length) opts[opts.length - 1].body += " " + line;
  }

  const type = weights ? "weighted" : "single";
  const options = opts.map((o) => ({ ...o, score: weights ? weights[o.label] ?? 0 : o.label === key ? 5 : 0 }));
  const errors: string[] = [];
  if (!body) errors.push("Teks soal kosong.");
  if (opts.length !== 5) errors.push(`Butuh 5 opsi A–E, ditemukan ${opts.length}.`);
  if (new Set(opts.map((o) => o.label)).size !== opts.length) errors.push("Ada label opsi ganda.");
  if (!key && !weights) errors.push("Tidak ada baris Kunci: atau Bobot:.");
  if (key && !opts.some((o) => o.label === key)) errors.push(`Kunci ${key} tidak ada di opsi.`);
  if (weights && opts.some((o) => !weights![o.label])) errors.push("Bobot TKP harus diisi 1–5 untuk setiap opsi.");

  return { body, options, type, explanation: explanation.trim(), needsImage: /\[gambar\]/i.test(body), errors };
}
