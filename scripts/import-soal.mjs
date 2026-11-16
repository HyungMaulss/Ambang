// B7: impor massal soal oleh admin. Pakai service role key, jalankan dari komputer Anda (bukan browser).
//   npm run import-soal                 → semua file bawaan: data/soal-contoh.json (kategori & konfigurasi) lalu data/soal-*.json
//   npm run import-soal -- soal.csv     → file tertentu (JSON atau CSV), bisa lebih dari satu
// CSV kolom: category,type,body,A,B,C,D,E,kunci,explanation,difficulty,source
//   kunci = "C" (single) atau "A=3;B=1;C=5;D=4;E=2" (weighted/TKP)
// Soal impor admin langsung berstatus published + public. Soal dengan teks sama di kategori sama dilewati.
import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync } from "node:fs";

const files = process.argv.length > 2
  ? process.argv.slice(2)
  : ["data/soal-contoh.json", ...readdirSync("data").filter((f) => /^soal-(?!contoh).*.json$/.test(f)).sort().map((f) => `data/${f}`)];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Pakai: node --env-file=.env.local scripts/import-soal.mjs <file.json|file.csv>  (butuh NEXT_PUBLIC_SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") row.push(cell), (cell = "");
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell), rows.push(row), (row = []), (cell = "");
    } else cell += ch;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

function fromCsvRow(r) {
  const options = ["A", "B", "C", "D", "E"].map((l) => r[l]);
  let scores;
  if (r.type === "weighted") {
    const w = Object.fromEntries([...r.kunci.matchAll(/([A-E])\s*=\s*([1-5])/gi)].map(([, l, v]) => [l.toUpperCase(), Number(v)]));
    scores = ["A", "B", "C", "D", "E"].map((l) => w[l] ?? 0);
  } else scores = ["A", "B", "C", "D", "E"].map((l) => (l === r.kunci.toUpperCase() ? 5 : 0));
  return { category: r.category, type: r.type || "single", body: r.body, options, scores, explanation: r.explanation, difficulty: Number(r.difficulty) || 2, source: r.source };
}

function validate(q, i) {
  const err = [];
  if (!q.category || !q.body) err.push("category/body kosong");
  if (q.options?.length !== 5 || q.options.some((o) => !o)) err.push("butuh 5 opsi");
  if (q.type === "single" && q.scores.filter((s) => s === 5).length !== 1) err.push("butuh tepat satu kunci");
  if (q.type === "weighted" && q.scores.some((s) => s < 1 || s > 5)) err.push("bobot TKP harus 1–5 untuk semua opsi");
  if (err.length) console.warn(`  baris ${i + 1} dilewati: ${err.join(", ")}`);
  return !err.length;
}

for (const file of files) {
console.log(`— ${file}`);
const text = readFileSync(file, "utf8");
const data = file.endsWith(".json") ? JSON.parse(text) : { questions: parseCsv(text).map(fromCsvRow) };

if (data.categories?.length) {
  // induk dulu agar foreign key parent_id terpenuhi
  const sorted = [...data.categories].sort((a, b) => (a.parent_id ? 1 : 0) - (b.parent_id ? 1 : 0));
  const { error } = await db.from("categories").upsert(sorted);
  if (error) throw error;
  console.log(`Kategori: ${sorted.length} di-upsert.`);
}
if (data.examConfig) {
  const { error } = await db.from("exam_configs").upsert(data.examConfig);
  if (error) throw error;
}

let added = 0, skipped = 0;
for (const [i, q] of (data.questions ?? []).entries()) {
  if (!validate(q, i)) continue;
  const { data: dup } = await db.from("questions").select("id").eq("category_id", q.category).eq("body", q.body).limit(1);
  if (dup?.length) {
    skipped++;
    continue;
  }
  const { data: row, error } = await db
    .from("questions")
    .insert({ category_id: q.category, type: q.type, body: q.body, explanation: q.explanation, difficulty: q.difficulty ?? 2, source: q.source ?? "Orisinal Ambang", status: "published", visibility: "public", owner_id: null })
    .select("id")
    .single();
  if (error) throw new Error(`baris ${i + 1}: ${error.message}`);
  const { error: e2 } = await db.from("question_options").insert(q.options.map((body, j) => ({ question_id: row.id, label: "ABCDE"[j], body, score: q.scores[j] })));
  if (e2) throw new Error(`opsi baris ${i + 1}: ${e2.message}`);
  added++;
}
console.log(`Soal: ${added} ditambahkan, ${skipped} sudah ada.`);
}
