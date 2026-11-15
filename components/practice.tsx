"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkAnswer, savePractice, type Question } from "@/lib/bank";
import { scoreAnswers, type Breakdown } from "@/lib/scoring";
import { AiPanel, ExplainButton, ReportButton } from "./explain";
import { Icon, OptionButton, Spinner, type OptionState } from "./ui";

type Result = { scores: Record<string, number>; explanation: string };

/** Opsi dalam keadaan tinjau: kunci menyala, jawaban salah dicoret, TKP tampilkan bobot. */
export function reviewState(q: Question, label: string, picked: string | undefined, scores: Record<string, number>): OptionState {
  const max = Math.max(...Object.values(scores));
  const isPicked = q.options.find((o) => o.label === label)?.id === picked;
  if (q.type === "weighted") return isPicked ? "selected" : scores[label] === max ? "key" : "muted";
  if (scores[label] === max) return "key";
  return isPicked ? "wrong" : "muted";
}

export function PracticeSession({ questions, onExit, local = false }: { questions: Question[]; onExit: () => void; local?: boolean }) {
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, Result>>({});
  const [ai, setAi] = useState<Record<string, { content?: string; error?: string }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Breakdown | null>(null);
  const startedAt = useRef(new Date().toISOString());

  const q = questions[idx];
  const res = q && results[q.id];

  const pick = useCallback(
    async (optionId: string) => {
      if (!q || picks[q.id] || loading) return;
      setPicks((p) => ({ ...p, [q.id]: optionId }));
      setLoading(true);
      setError("");
      try {
        const r = await checkAnswer(q);
        setResults((x) => ({ ...x, [q.id]: r }));
      } catch (e) {
        setError((e as Error).message);
        setPicks(({ [q.id]: _, ...rest }) => rest);
      } finally {
        setLoading(false);
      }
    },
    [q, picks, loading],
  );

  const finish = useCallback(() => {
    const scored = questions.map((x) => ({
      id: x.id,
      group: x.categoryName,
      options: x.options.map((o) => ({ ...o, score: results[x.id]?.scores[o.label] ?? 0 })),
    }));
    const b = scoreAnswers(scored, picks);
    setDone(b);
    if (!local) savePractice(b, startedAt.current).catch(() => {});
  }, [questions, results, picks, local]);

  const next = useCallback(() => (idx + 1 < questions.length ? setIdx(idx + 1) : finish()), [idx, questions.length, finish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done || (e.target as HTMLElement).closest("input,textarea")) return;
      const i = "abcde".indexOf(e.key.toLowerCase());
      if (i >= 0 && q?.options[i]) pick(q.options[i].id);
      if ((e.key === "Enter" || e.key === "ArrowRight") && res) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, res, pick, next, done]);

  const retry = () => {
    setIdx(0);
    setPicks({});
    setResults({});
    setDone(null);
    startedAt.current = new Date().toISOString();
  };
  if (done) return <PracticeSummary b={done} onExit={onExit} onRetry={retry} saved={!local} />;
  if (!q) return null;

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6 px-5 pb-16 md:px-0">
      <div className="h-[3px] w-full bg-line" aria-hidden>
        <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${((idx + (res ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>
      <div className="flex flex-wrap items-center gap-3.5">
        <span className="font-display text-[14px] font-medium text-accent">
          Soal {idx + 1} dari {questions.length}
        </span>
        <span className="tag text-muted">{q.categoryName}</span>
      </div>
      <h2 key={q.id} className="anim-fade-up font-display text-[26px] leading-[1.2] tracking-[-0.03em] whitespace-pre-line md:text-[34px]">
        {q.body}
      </h2>
      <div className="flex flex-col gap-2.5" role="group" aria-label="Pilihan jawaban">
        {q.options.map((o) => (
          <OptionButton
            key={o.id}
            label={o.label}
            body={o.body}
            disabled={!!picks[q.id]}
            onClick={() => pick(o.id)}
            state={res ? reviewState(q, o.label, picks[q.id], res.scores) : picks[q.id] === o.id ? "selected" : "default"}
            score={res && q.type === "weighted" ? res.scores[o.label] : undefined}
          />
        ))}
      </div>
      {loading && (
        <p className="flex items-center gap-2 text-[14px] text-muted">
          <Spinner /> Memeriksa jawaban…
        </p>
      )}
      {error && <p className="text-[14px] text-danger">{error}</p>}

      {res && (
        <div className="anim-fade-up flex flex-col gap-4">
          <div className="card p-4 md:p-5">
            <p className="eyebrow">
              {q.type === "weighted"
                ? `Nilai Anda +${res.scores[q.options.find((o) => o.id === picks[q.id])!.label]} dari 5`
                : res.scores[q.options.find((o) => o.id === picks[q.id])!.label] > 0
                  ? "Benar · +5"
                  : "Belum tepat · 0"}
            </p>
            <p className="mt-2 text-[15px] leading-[1.6]">{res.explanation || "Belum ada pembahasan singkat untuk soal ini."}</p>
          </div>
          <AiPanel questionId={q.id} {...ai[q.id]} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <ExplainButton
              questionId={q.id}
              disabledReason={local ? "Soal unggahan sekali pakai tidak dikirim ke server, jadi tanpa AI." : undefined}
              onResult={(r) => setAi((x) => ({ ...x, [q.id]: r }))}
            />
            <div className="flex-1">
              <ReportButton questionId={q.id} kind="soal" />
            </div>
            <button type="button" onClick={next} className="btn btn-accent justify-between">
              {idx + 1 < questions.length ? "Berikutnya" : "Lihat hasil"} <Icon.Arrow />
            </button>
          </div>
        </div>
      )}
      <p className="hidden text-[13px] text-muted md:block">Pintasan: A–E pilih jawaban · Enter atau → soal berikutnya</p>
    </div>
  );
}

function PracticeSummary({ b, onExit, onRetry, saved }: { b: Breakdown; onExit: () => void; onRetry: () => void; saved: boolean }) {
  const score = b.groups.reduce((s, g) => s + g.score, 0);
  const max = b.groups.reduce((s, g) => s + g.max, 0);
  return (
    <div className="anim-fade-up mx-auto flex max-w-[760px] flex-col gap-6 px-5 pb-16 md:px-0">
      <p className="eyebrow">Latihan selesai</p>
      <h2 className="font-display text-[40px] leading-none tracking-[-0.03em] md:text-[56px]">
        {score} <span className="text-muted">/ {max}</span>
      </h2>
      <div className="flex flex-col gap-3">
        {b.groups.map((g) => (
          <div key={g.code} className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[14px]">
              <span>{g.code}</span>
              <span className="text-muted">
                {g.score}/{g.max}
              </span>
            </div>
            <div className="h-2 bg-line">
              <div className="anim-draw h-full bg-fg" style={{ width: `${g.max ? (g.score / g.max) * 100 : 0}%`, animationDelay: "0s" }} />
            </div>
          </div>
        ))}
      </div>
      <p className="text-[14px] text-muted">{saved ? "Ringkasan tersimpan di Statistik (bila sudah masuk atau di mode demo)." : "Latihan sekali pakai: tidak ada yang disimpan."}</p>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <button type="button" onClick={onRetry} className="btn btn-primary justify-between">
          Latihan lagi <Icon.Arrow />
        </button>
        <button type="button" onClick={onExit} className="btn btn-secondary justify-between">
          Pilih kategori lain <Icon.Arrow />
        </button>
      </div>
    </div>
  );
}
