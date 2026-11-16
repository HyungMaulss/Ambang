import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HyperFormula } from "hyperformula";
import { LESSONS } from "./excel-lessons.ts";
import { normalizeFormula } from "./excel-formula.ts";

const read = (f: string) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), "utf8"));
const seed = read("soal-contoh.json");
const questions = ["soal-twk.json", "soal-tiu.json", "soal-tkp.json", "soal-psi.json"].flatMap((f) => read(f).questions);
const parent = Object.fromEntries(seed.categories.map((c: { id: string; parent_id: string | null }) => [c.id, c.parent_id ?? c.id]));

test("bank soal: setiap soal valid dan cukup untuk satu tryout penuh", () => {
  const bodies = new Set<string>();
  for (const q of questions) {
    assert.ok(parent[q.category], `kategori tidak dikenal: ${q.category}`);
    assert.equal(q.options.length, 5, q.body);
    assert.equal(new Set(q.options).size, 5, `opsi ganda: ${q.body}`);
    if (q.type === "single") assert.deepEqual([...q.scores].sort(), [0, 0, 0, 0, 5], `kunci: ${q.body}`);
    else assert.deepEqual([...q.scores].sort(), [1, 2, 3, 4, 5], `bobot TKP: ${q.body}`);
    assert.ok(!bodies.has(q.body), `duplikat: ${q.body}`);
    bodies.add(q.body);
  }
  for (const { category, count } of seed.examConfig.per_category_count) {
    const n = questions.filter((q) => parent[q.category] === category).length;
    assert.ok(n >= count, `${category}: ${n} soal, butuh ${count}`);
  }
});

test("Excel Lab: semua rumus solusi menghasilkan nilai, bukan error", () => {
  const COLS = "ABCDEFGH";
  assert.equal(new Set(LESSONS.map((l) => l.exercise.id)).size, LESSONS.length);
  for (const { slug, exercise: ex } of LESSONS) {
    const w = Math.max(...ex.grid.map((r) => r.length));
    const g = ex.grid.map((r) => [...r, ...Array(w - r.length).fill("")]);
    for (const t of ex.targets) g[Number(t.cell.slice(1)) - 1][COLS.indexOf(t.cell[0])] = t.solution;
    const input = g.map((r) => r.map((x) => (x.startsWith("=") ? normalizeFormula(x) : x.trim() !== "" && !isNaN(Number(x)) ? Number(x) : x)));
    const hf = HyperFormula.buildFromArray(input, { licenseKey: "gpl-v3" });
    const v = hf.getSheetValues(0);
    for (const t of ex.targets) {
      const x = v[Number(t.cell.slice(1)) - 1][COLS.indexOf(t.cell[0])];
      assert.ok(x !== null && x !== "" && typeof x !== "object", `${slug} ${t.cell} = ${JSON.stringify(x)}`);
    }
    hf.destroy();
  }
});

test("katalog fungsi Excel Lab hanya berisi fungsi yang didukung mesin", async () => {
  const { FUNCTION_NAMES } = await import("./excel-functions.ts");
  const supported = new Set(HyperFormula.getRegisteredFunctionNames("enGB"));
  const missing = FUNCTION_NAMES.filter((f) => !supported.has(f));
  assert.deepEqual(missing, []);
});
