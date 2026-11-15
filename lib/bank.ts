"use client";

// Satu-satunya pintu data. Dua jalur:
// - Supabase (produksi): kunci jawaban tidak pernah dikirim sebelum dijawab/submit (RPC di supabase/schema.sql).
// - Mode demo (tanpa env Supabase): soal contoh lokal, riwayat di localStorage. Kunci ikut di bundle — khusus demo.
import seed from "@/data/soal-contoh.json";
import { scoreAnswers, type Breakdown } from "./scoring";
import { supabase } from "./supabase";

export const DEMO = !supabase;

export type Option = { id: string; label: string; body: string; score?: number };
export type Question = {
  id: string;
  category: string; // subkategori, mis. TIU-NUM
  group: string; // kategori induk, mis. TIU
  categoryName: string;
  type: "single" | "weighted";
  body: string;
  options: Option[];
  explanation?: string;
};
export type Category = { id: string; parent_id: string | null; name: string; tooltip_text: string | null };
export type ExamConfig = typeof seed.examConfig;
export type Review = Record<string, { scores: Record<string, number>; explanation: string }>;
export type Attempt = { id: string; mode: "practice" | "tryout"; started_at: string; finished_at: string | null; score_breakdown: Breakdown | null };
export type TryoutSession = { attemptId: string; startedAt: string; durationMin: number; questions: Question[] };

const LABELS = "ABCDE";
const catById = new Map(seed.categories.map((c) => [c.id, c]));
const groupOf = (id: string) => catById.get(id)?.parent_id ?? id;

const DEMO_QUESTIONS: Question[] = seed.questions.map((q, i) => ({
  id: `demo-${i}`,
  category: q.category,
  group: groupOf(q.category),
  categoryName: `${groupOf(q.category)} · ${catById.get(q.category)?.name ?? ""}`,
  type: q.type as Question["type"],
  body: q.body,
  explanation: q.explanation,
  options: q.options.map((body, j) => ({ id: `demo-${i}-${LABELS[j]}`, label: LABELS[j], body, score: q.scores[j] })),
}));

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

const local = {
  get<T>(key: string, fallback: T): T {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* penyimpanan penuh/diblokir: abaikan, data hanya di memori */
    }
  },
};

export async function getCategories(): Promise<Category[]> {
  if (!supabase) return seed.categories;
  return must(await supabase.from("categories").select("id,parent_id,name,tooltip_text").order("id"));
}

export async function getConfig(): Promise<ExamConfig> {
  if (!supabase) return seed.examConfig;
  return must(await supabase.from("exam_configs").select("*").order("year", { ascending: false }).limit(1).single());
}

/** category: kode induk (TWK), subkategori (TIU-NUM), atau "PRIBADI" untuk soal pribadi. */
export async function practiceSet(category: string, limit: number): Promise<Question[]> {
  if (!supabase) {
    return shuffle(DEMO_QUESTIONS.filter((q) => q.category === category || q.group === category)).slice(0, limit);
  }
  return must(await supabase.rpc("practice_set", { p_category: category, p_limit: limit }));
}

/** Kunci & pembahasan satu soal. Soal lokal (demo/unggahan sekali pakai) membawa skornya sendiri. */
export async function checkAnswer(q: Question): Promise<{ scores: Record<string, number>; explanation: string }> {
  if (q.options.every((o) => o.score !== undefined)) {
    return { scores: Object.fromEntries(q.options.map((o) => [o.label, o.score!])), explanation: q.explanation ?? "" };
  }
  return must(await supabase!.rpc("check_answer", { p_question: q.id }));
}

export async function startTryout(config: ExamConfig): Promise<TryoutSession> {
  if (!supabase) {
    const questions = config.per_category_count.flatMap(({ category, count }) =>
      shuffle(DEMO_QUESTIONS.filter((q) => q.group === category)).slice(0, count),
    );
    return { attemptId: `demo-${Date.now()}`, startedAt: new Date().toISOString(), durationMin: config.duration_min, questions };
  }
  return must(await supabase.rpc("start_tryout", { p_config: config.id }));
}

export async function submitTryout(
  s: TryoutSession,
  answers: Record<string, string>,
  flags: Record<string, boolean>,
  passing: Record<string, number>,
): Promise<{ breakdown: Breakdown; review: Review }> {
  if (!supabase) {
    const scored = s.questions.map((q) => ({ id: q.id, group: q.group, options: q.options.map((o) => ({ ...o, score: o.score ?? 0 })) }));
    const breakdown = scoreAnswers(scored, answers, passing);
    const review: Review = {};
    for (const q of s.questions) review[q.id] = (await checkAnswer(q)) as Review[string];
    saveLocalAttempt({ id: s.attemptId, mode: "tryout", started_at: s.startedAt, finished_at: new Date().toISOString(), score_breakdown: breakdown });
    return { breakdown, review };
  }
  const p_answers = s.questions.map((q) => ({ question_id: q.id, option_id: answers[q.id] ?? null, is_flagged: !!flags[q.id] }));
  return must(await supabase.rpc("submit_tryout", { p_attempt: s.attemptId, p_answers }));
}

function saveLocalAttempt(a: Attempt) {
  local.set("ambang:attempts", [a, ...local.get<Attempt[]>("ambang:attempts", [])].slice(0, 100));
}

/** Ringkasan latihan per subkategori (riwayat diringkas per sesi, bukan per jawaban). */
export async function savePractice(breakdown: Breakdown, startedAt: string) {
  const row = { mode: "practice" as const, started_at: startedAt, finished_at: new Date().toISOString(), score_breakdown: breakdown };
  if (!supabase) return saveLocalAttempt({ id: `demo-${Date.now()}`, ...row });
  const { data } = await supabase.auth.getUser();
  if (!data.user) return; // tamu: riwayat tidak disimpan (A2)
  must(await supabase.from("attempts").insert(row));
}

export async function listAttempts(): Promise<Attempt[]> {
  if (!supabase) return local.get<Attempt[]>("ambang:attempts", []);
  return must(
    await supabase.from("attempts").select("id,mode,started_at,finished_at,score_breakdown").not("finished_at", "is", null).order("started_at", { ascending: false }).limit(100),
  );
}

export async function saveExcel(exerciseId: string, formulas: Record<string, string>, score: number) {
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  must(await supabase.from("excel_submissions").insert({ exercise_id: exerciseId, formulas, score, graded: true }));
}

export async function report(questionId: string, kind: "soal" | "ai", note: string) {
  if (!supabase) return;
  must(await supabase.from("reports").insert({ question_id: questionId, kind, note }));
}

/** Simpan soal hasil konversi sebagai soal pribadi (teks saja; file tidak pernah dikirim). */
export async function savePrivateQuestions(
  items: { body: string; type: string; explanation: string; options: { label: string; body: string; score: number }[] }[],
  category: string,
  submitForReview: boolean,
) {
  if (!supabase) throw new Error("Mode demo: menyimpan ke akun butuh Supabase.");
  for (const it of items) {
    const q = must(
      await supabase
        .from("questions")
        .insert({ category_id: category, type: it.type, body: it.body, explanation: it.explanation, source: "Unggahan pengguna", status: submitForReview ? "review" : "draft", visibility: "private" })
        .select("id")
        .single(),
    ) as { id: string };
    must(await supabase.from("question_options").insert(it.options.map((o) => ({ ...o, question_id: q.id }))));
  }
}

export async function explain(questionId: string): Promise<{ content: string; cached: boolean }> {
  const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : undefined;
  const res = await fetch("/api/explain", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ questionId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Gagal memuat penjelasan.");
  return body;
}

export const storage = local;
