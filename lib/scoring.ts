// Logika skor murni (tanpa dependensi) — dipakai mode demo & latihan.
// Versi server tryout ada di supabase/schema.sql (submit_tryout) dengan aturan yang sama.

export type ScoredOption = { id: string; label: string; score: number };
export type ScoredQuestion = { id: string; group: string; options: ScoredOption[] };

export type GroupScore = { code: string; score: number; max: number; answered: number; total: number; passing?: number; passed?: boolean };
export type Breakdown = { groups: GroupScore[]; total: number; passed: boolean };

/**
 * Jumlahkan skor opsi yang dipilih per kelompok (TWK/TIU/TKP atau subkategori).
 * Skor maks per soal = skor opsi tertinggi (5 untuk TWK/TIU/TKP). Kosong = 0.
 */
export function scoreAnswers(
  questions: ScoredQuestion[],
  answers: Record<string, string | undefined>,
  passing: Record<string, number> = {},
): Breakdown {
  const map = new Map<string, GroupScore>();
  for (const q of questions) {
    const g = map.get(q.group) ?? { code: q.group, score: 0, max: 0, answered: 0, total: 0 };
    g.total++;
    g.max += Math.max(0, ...q.options.map((o) => o.score));
    const picked = q.options.find((o) => o.id === answers[q.id]);
    if (picked) {
      g.answered++;
      g.score += picked.score;
    }
    map.set(q.group, g);
  }
  const groups = [...map.values()].map((g) =>
    passing[g.code] === undefined ? g : { ...g, passing: passing[g.code], passed: g.score >= passing[g.code] },
  );
  return {
    groups,
    total: groups.reduce((s, g) => s + g.score, 0),
    passed: groups.every((g) => g.passed !== false),
  };
}
