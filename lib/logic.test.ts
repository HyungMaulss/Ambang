import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreAnswers } from "./scoring.ts";
import { parseSoal } from "./parse-soal.ts";
import { normalizeFormula, usesFunction } from "./excel-formula.ts";

const opt = (q: string, scores: number[]) => scores.map((score, i) => ({ id: `${q}${i}`, label: "ABCDE"[i], score }));

test("skor SKD: TWK/TIU 5/0, TKP berbobot, kosong = 0, ambang per kategori", () => {
  const qs = [
    { id: "t1", group: "TWK", options: opt("t1", [0, 5, 0, 0, 0]) },
    { id: "t2", group: "TWK", options: opt("t2", [5, 0, 0, 0, 0]) },
    { id: "k1", group: "TKP", options: opt("k1", [3, 1, 5, 4, 2]) },
    { id: "k2", group: "TKP", options: opt("k2", [1, 2, 5, 3, 4]) },
  ];
  const b = scoreAnswers(qs, { t1: "t11", t2: "t21", k1: "k13", k2: undefined }, { TWK: 5, TKP: 5 });
  const twk = b.groups.find((g) => g.code === "TWK")!;
  const tkp = b.groups.find((g) => g.code === "TKP")!;
  assert.deepEqual([twk.score, twk.max, twk.answered, twk.passed], [5, 10, 2, true]);
  assert.deepEqual([tkp.score, tkp.max, tkp.answered, tkp.passed], [4, 10, 1, false]);
  assert.equal(b.total, 9);
  assert.equal(b.passed, false);
});

test("parser template: single, TKP berbobot, error, gambar", () => {
  const txt = `Soal 1: Jika 3x + 7 = 25,
berapakah 2x − 4?
A. 4
B. 6
C. 8
D. 10
E. 12
Kunci: C
Pembahasan: x = 6.

Soal 2. Sikap Anda [gambar]
A) a
B) b
C) c
D) d
E) e
Bobot: A=3, B=1, C=5, D=4, E=2

Soal: tanpa kunci
A. x
B. y`;
  const [a, b, c] = parseSoal(txt);
  assert.equal(a.body, "Jika 3x + 7 = 25,\nberapakah 2x − 4?");
  assert.deepEqual(a.options.map((o) => o.score), [0, 0, 5, 0, 0]);
  assert.equal(a.explanation, "x = 6.");
  assert.deepEqual(a.errors, []);
  assert.equal(b.type, "weighted");
  assert.deepEqual(b.options.map((o) => o.score), [3, 1, 5, 4, 2]);
  assert.equal(b.needsImage, true);
  assert.equal(c.errors.length, 2);
});

test("rumus Excel: ; jadi , kecuali di dalam string", () => {
  assert.equal(normalizeFormula('=IF(A1>0;"a;b";0)'), '=IF(A1>0,"a;b",0)');
  assert.equal(normalizeFormula("teks;biasa"), "teks;biasa");
  assert.equal(normalizeFormula('=VLOOKUP(E3;A2:B5;2;FALSE)'), "=VLOOKUP(E3,A2:B5,2,FALSE())");
  assert.equal(normalizeFormula('=IF(TRUE();"FALSE";false)'), '=IF(TRUE(),"FALSE",false())');
  assert.ok(usesFunction("=xlookup(A1,B:B,C:C)", "XLOOKUP"));
  assert.ok(!usesFunction("=VLOOKUP(A1,B:C,2)", "LOOKUP"));
});

import { canInsertRef, currentFunction, fnPrefix, rangeText, refsIn, shiftFormula, upperFormula } from "./excel-formula.ts";

test("editor Excel: geser rumus saat disalin/diisi", () => {
  assert.equal(shiftFormula("=B2*C2", 1, 0), "=B3*C3");
  assert.equal(shiftFormula("=ROUND(B2/$B$5*100;1)", 2, 0), "=ROUND(B4/$B$5*100;1)");
  assert.equal(shiftFormula("=$A2+B$1", 3, 1), "=$A5+C$1");
  assert.equal(shiftFormula('=IF(A1="B2";LOG10(A1);0)', 1, 0), '=IF(A2="B2";LOG10(A2);0)');
  assert.equal(shiftFormula("=A1", -1, 0), "=#REF!");
  assert.equal(shiftFormula("teks A1", 1, 0), "teks A1");
  assert.equal(upperFormula('=sum(b2:b4)&"abc"'), '=SUM(B2:B4)&"abc"');
});

test("editor Excel: referensi, titik sisip, saran, petunjuk argumen", () => {
  assert.equal(rangeText({ r: 4, c: 3 }, { r: 1, c: 1 }), "B2:D5");
  assert.equal(rangeText({ r: 0, c: 0 }, { r: 0, c: 0 }), "A1");
  const refs = refsIn('=SUM(B2:B4)+$C$1+"D9"');
  assert.deepEqual(refs.map((r) => [r.text, r.start, r.end]), [["B2:B4", 5, 10], ["$C$1", 12, 16]]);
  assert.deepEqual(refs[0].to, { r: 3, c: 1 });
  assert.ok(canInsertRef("=SUM("));
  assert.ok(canInsertRef("=B2*"));
  assert.ok(canInsertRef("=IF(A1>0; "));
  assert.ok(!canInsertRef("=SUM(B2"));
  assert.ok(!canInsertRef('=IF(A1="'));
  assert.ok(!canInsertRef("teks+"));
  assert.equal(fnPrefix("=SUM(xl"), "xl");
  assert.equal(fnPrefix("=B2"), null);
  assert.equal(fnPrefix("=IF(A1>0;vl"), "vl");
  assert.deepEqual(currentFunction("=IF(A1>0;VLOOKUP(E2;A2:B4;"), { name: "VLOOKUP", arg: 2 });
  assert.deepEqual(currentFunction("=IF(A1>0;SUM(B2:B3);"), { name: "IF", arg: 2 });
  assert.equal(currentFunction("=B2*C2"), null);
});
