import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

// D2–D5: AI hanya dipanggil di server, hasil di-cache per soal, kuota harian per pengguna.
// Yang dikirim ke AI hanya teks soal, opsi, kunci terverifikasi — tidak ada data pribadi.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiKey = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const LIMIT = Number(process.env.AI_DAILY_LIMIT || 20);

const fail = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(req: Request) {
  if (!url || !serviceKey) return fail(503, "Pembahasan AI butuh Supabase (mode demo tidak mendukung).");
  const { questionId } = await req.json().catch(() => ({}));
  if (typeof questionId !== "string" || !/^[0-9a-f-]{36}$/i.test(questionId)) return fail(400, "questionId tidak valid.");

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  const user = token ? (await admin.auth.getUser(token)).data.user : null;

  const { data: q } = await admin
    .from("questions")
    .select("id, body, type, explanation, status, visibility, owner_id, category_id, question_options(label, body, score)")
    .eq("id", questionId)
    .single();
  const visible = q && ((q.visibility === "public" && q.status === "published") || (user && q.owner_id === user.id));
  if (!q || !visible) return fail(404, "Soal tidak ditemukan.");

  // Jangan bocorkan pembahasan untuk soal yang sedang dikerjakan di tryout.
  if (user) {
    const { data: active } = await admin
      .from("attempt_answers")
      .select("attempt_id, attempts!inner(user_id, finished_at, started_at, mode)")
      .eq("question_id", questionId)
      .eq("attempts.user_id", user.id)
      .eq("attempts.mode", "tryout")
      .is("attempts.finished_at", null)
      .gte("attempts.started_at", new Date(Date.now() - 110 * 60_000).toISOString())
      .limit(1);
    if (active?.length) return fail(403, "Pembahasan tersedia setelah tryout dikumpulkan.");
  }

  const { data: cached } = await admin.from("ai_explanations").select("content").eq("question_id", questionId).maybeSingle();
  if (cached) return Response.json({ content: cached.content, cached: true });

  if (!geminiKey) return fail(503, "GEMINI_API_KEY belum diatur di server.");
  if (!user) return fail(401, "Masuk dulu untuk meminta penjelasan baru.");

  const today = new Date().toISOString().slice(0, 10);
  const { data: prof } = await admin.from("profiles").select("ai_quota_used, ai_quota_date").eq("id", user.id).single();
  const used = prof?.ai_quota_date === today ? prof.ai_quota_used : 0;
  if (used >= LIMIT) return fail(429, `Kuota harian ${LIMIT} penjelasan baru sudah habis. Coba lagi besok.`);

  const opts = [...(q.question_options ?? [])].sort((a, b) => a.label.localeCompare(b.label));
  const keyLine =
    q.type === "weighted"
      ? `Ini soal TKP berbobot. Nilai tiap opsi: ${opts.map((o) => `${o.label}=${o.score}`).join(", ")}.`
      : `Kunci jawaban yang sudah diverifikasi: ${opts.find((o) => o.score === Math.max(...opts.map((x) => x.score)))?.label}.`;
  const prompt = [
    "Kamu tutor SKD CPNS. Jelaskan dalam bahasa Indonesia yang ringkas (maks. 180 kata), tanpa basa-basi.",
    "Jangan mengubah kunci atau nilai. Jelaskan langkah/alasan, lalu satu kalimat kenapa opsi pengecoh keliru.",
    "Jika soal TKP, jelaskan logika urutan nilainya. Pakai teks biasa, tanpa markdown tebal atau judul.",
    "",
    `Soal: ${q.body}`,
    ...opts.map((o) => `${o.label}. ${o.body}`),
    keyLine,
    q.explanation ? `Pembahasan singkat yang ada: ${q.explanation}` : "",
  ].join("\n");

  let content: string | undefined;
  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const res = await ai.models.generateContent({ model: MODEL, contents: prompt });
    content = res.text?.trim();
  } catch (e) {
    console.error("gemini", e);
  }
  if (!content) return fail(502, "Layanan AI sedang tidak tersedia. Pembahasan singkat tetap bisa dibaca.");

  await admin.from("ai_explanations").upsert({ question_id: questionId, content, model: MODEL }, { onConflict: "question_id", ignoreDuplicates: true });
  await admin.from("profiles").update({ ai_quota_used: used + 1, ai_quota_date: today }).eq("id", user.id);
  return Response.json({ content, cached: false });
}
