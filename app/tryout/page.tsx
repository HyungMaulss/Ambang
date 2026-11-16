"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CountUp } from "@/components/count-up";
import { AiPanel, ExplainButton, ReportButton } from "@/components/explain";
import { ThemeToggle } from "@/components/header";
import { reviewState } from "@/components/practice";
import { Icon, Logo, LogoMark, OptionButton, Spinner, Tip } from "@/components/ui";
import { DEMO, getConfig, startTryout, storage, submitTryout, type ExamConfig, type Review, type TryoutSession } from "@/lib/bank";
import type { Breakdown } from "@/lib/scoring";
import { supabase, useUser } from "@/lib/supabase";

type Saved = { session: TryoutSession; answers: Record<string, string>; flags: Record<string, boolean>; idx: number };
type Phase = "intro" | "exam" | "result" | "review";
const KEY = "ambang:tryout"; // C4: jawaban tersimpan lokal sampai berhasil dikumpulkan

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function TryoutPage() {
  const user = useUser();
  const [config, setConfig] = useState<ExamConfig | null>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [state, setState] = useState<Saved | null>(null);
  const [result, setResult] = useState<{ breakdown: Breakdown; review: Review } | null>(null);
  const [leftRaw, setLeft] = useState<number | null>(null); // null = timer belum dihitung
  const left = leftRaw ?? 0;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<string>("");
  const [ai, setAi] = useState<Record<string, { content?: string; error?: string }>>({});
  const confirmRef = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    getConfig().then(setConfig).catch((e) => setError(e.message));
    const saved = storage.get<Saved | null>(KEY, null);
    if (saved?.session?.questions?.length) {
      setState(saved);
      setPhase("exam");
    }
  }, []);

  useEffect(() => {
    if (state && phase === "exam") storage.set(KEY, state);
  }, [state, phase]);

  const session = state?.session;
  const q = session?.questions[state!.idx];
  const groups = useMemo(() => [...new Set(session?.questions.map((x) => x.group) ?? [])], [session]);
  useEffect(() => {
    if (q) setView(q.group);
  }, [q]);

  const submit = useCallback(async () => {
    if (!state || !config) return;
    confirmRef.current?.close();
    setBusy(true);
    setError("");
    try {
      const r = await submitTryout(state.session, state.answers, state.flags, config.passing_grade);
      setResult(r);
      setPhase("result");
      try {
        localStorage.removeItem(KEY);
      } catch {}
    } catch (e) {
      setError(`Gagal mengumpulkan: ${(e as Error).message}. Jawaban aman di perangkat ini — coba lagi.`);
    } finally {
      setBusy(false);
    }
  }, [state, config]);

  // Timer dihitung dari waktu mulai, jadi tetap benar setelah reload.
  useEffect(() => {
    if (phase !== "exam" || !session) return;
    const end = new Date(session.startedAt).getTime() + session.durationMin * 60_000;
    const tick = () => setLeft(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [phase, session]);
  const expired = phase === "exam" && leftRaw === 0;
  useEffect(() => {
    if (expired && !busy && !error) submit();
  }, [expired, busy, error, submit]);

  const go = useCallback((i: number) => setState((s) => (s && i >= 0 && i < s.session.questions.length ? { ...s, idx: i } : s)), []);
  const answer = useCallback(
    (optionId: string) => setState((s) => (s && phase === "exam" ? { ...s, answers: { ...s.answers, [s.session.questions[s.idx].id]: optionId } } : s)),
    [phase],
  );
  const flag = useCallback(
    () =>
      setState((s) => {
        if (!s || phase !== "exam") return s;
        const id = s.session.questions[s.idx].id;
        return { ...s, flags: { ...s.flags, [id]: !s.flags[id] } };
      }),
    [phase],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!state || !(phase === "exam" || phase === "review") || (e.target as HTMLElement).closest("input,textarea,dialog[open]")) return;
      const k = e.key.toLowerCase();
      const i = "abcde".indexOf(k);
      if (i >= 0 && q?.options[i]) answer(q.options[i].id);
      else if (e.key === "ArrowRight") go(state.idx + 1);
      else if (e.key === "ArrowLeft") go(state.idx - 1);
      else if (k === "r") flag();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, phase, q, answer, go, flag]);

  const begin = async () => {
    if (!config) return;
    setBusy(true);
    setError("");
    try {
      const s = await startTryout(config);
      if (!s.questions.length) throw new Error("Bank soal publik masih kosong.");
      setLeft(null);
      setState({ session: s, answers: {}, flags: {}, idx: 0 });
      setResult(null);
      setAi({});
      setPhase("exam");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const counts = useMemo(() => {
    const qs = session?.questions ?? [];
    const flagged = qs.filter((x) => state?.flags[x.id]).length;
    const answered = qs.filter((x) => state?.answers[x.id] && !state?.flags[x.id]).length;
    return { answered, flagged, empty: qs.length - answered - flagged, unanswered: qs.filter((x) => !state?.answers[x.id]).length };
  }, [session, state]);

  /* ---------- Intro ---------- */
  if (phase === "intro" || !state || !session || !q) {
    const needLogin = !!supabase && user === null;
    return (
      <Shell right={<ThemeToggle size={44} />}>
        <div className="mx-auto flex max-w-[760px] flex-col gap-8 px-5 py-10 md:py-16">
          <div className="anim-fade-up">
            <p className="eyebrow">Simulasi CAT</p>
            <h1 className="mt-3 font-display text-[40px] leading-[1.05] tracking-[-0.03em] md:text-[56px]">{config?.name ?? "Tryout SKD"}</h1>
          </div>
          {config ? (
            <div className="anim-fade-up grid grid-cols-3 overflow-hidden rounded-none border border-line" style={{ animationDelay: "80ms" }}>
              {config.per_category_count.map((p, i) => (
                <div key={p.category} className={`flex flex-col gap-0.5 px-4 py-3.5 md:px-5 ${i ? "border-l border-line" : ""}`}>
                  <span className="text-[12px] font-medium tracking-[0.06em] text-muted">{p.category}</span>
                  <span className="font-display text-[28px] tracking-[-0.03em]">{p.count} soal</span>
                  <span className="text-[13px] text-muted">ambang {config.passing_grade[p.category as keyof typeof config.passing_grade]}</span>
                </div>
              ))}
            </div>
          ) : (
            <Spinner />
          )}
          <ul className="anim-fade-up flex flex-col gap-2 text-[15px] leading-[1.55] text-muted" style={{ animationDelay: "160ms" }}>
            <li>· Waktu {config?.duration_min ?? 100} menit, berjalan terus walau halaman ditutup.</li>
            <li>· TWK & TIU: benar 5, salah/kosong 0. TKP: tiap opsi bernilai 1–5.</li>
            <li>· Jawaban disimpan di perangkat ini sampai berhasil dikumpulkan.</li>
            <li>· Kunci dan pembahasan baru dibuka setelah tryout dikumpulkan.</li>
          </ul>
          {DEMO && (
            <p className="card px-4 py-3 text-[14px] text-muted">
              <strong className="text-fg">Mode demo:</strong> soal diambil acak dari bank soal contoh orisinal di perangkat ini; riwayat tersimpan di browser.
            </p>
          )}
          {needLogin ? (
            <Link href="/masuk" className="btn btn-primary self-start">
              Masuk untuk mulai tryout <Icon.Arrow />
            </Link>
          ) : (
            <button type="button" onClick={begin} disabled={busy || !config || user === undefined} className="btn btn-accent self-start">
              {busy && <Spinner />} Mulai tryout <Icon.Arrow />
            </button>
          )}
          {error && <p className="text-[14px] text-danger">{error}</p>}
        </div>
      </Shell>
    );
  }

  /* ---------- Hasil ---------- */
  if (phase === "result" && result) {
    const b = result.breakdown;
    return (
      <Shell right={<ThemeToggle size={44} />}>
        <div className="mx-auto flex max-w-[860px] flex-col gap-8 px-5 py-10 md:py-16">
          <div className="anim-fade-up">
            <p className="eyebrow">Hasil tryout</p>
            <h1 className="mt-3 font-display text-[56px] leading-none tracking-[-0.04em] md:text-[84px]">
              <CountUp value={b.total} duration={1200} />
            </h1>
            <p className={`mt-4 inline-block rounded-none px-3 py-1.5 text-[15px] font-medium ${b.passed ? "bg-accent text-on-accent" : "border border-line"}`}>
              {b.passed ? "Lewat ambang batas di semua subtes" : "Belum lewat ambang batas di semua subtes"}
            </p>
          </div>
          <div className="flex flex-col gap-6">
            {b.groups.map((g, i) => {
              const pct = (v: number) => `${g.max ? Math.min(100, (v / g.max) * 100) : 0}%`;
              const gap = (g.passing ?? 0) - g.score;
              return (
                <div key={g.code} className="anim-fade-up flex flex-col gap-2" style={{ animationDelay: `${i * 100}ms` }}>
                  <div className="flex items-baseline justify-between">
                    <span className="font-display text-[22px] tracking-[-0.02em]">{g.code}</span>
                    <span className="text-[14px] text-muted">
                      {g.score} / {g.max} · {g.answered}/{g.total} dijawab
                    </span>
                  </div>
                  <div className="relative h-3 bg-line">
                    <div className="anim-draw h-full bg-fg" style={{ width: pct(g.score), animationDelay: `${0.2 + i * 0.1}s` }} />
                    {g.passing !== undefined && (
                      <Tip label={`Ambang batas ${g.code}: ${g.passing}`}>
                        <span tabIndex={0} className="absolute -top-1.5 h-6 w-1 bg-accent" style={{ left: pct(g.passing) }} />
                      </Tip>
                    )}
                  </div>
                  <p className="text-[14px] text-muted">
                    {g.passing === undefined ? "" : gap > 0 ? `Jarak ke ambang: ${gap} poin lagi.` : `Lewat ambang ${g.passing} (+${-gap}).`}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <button type="button" onClick={() => (setPhase("review"), go(0))} className="btn btn-primary justify-between">
              Tinjau jawaban <Icon.Arrow />
            </button>
            <button type="button" onClick={begin} disabled={busy} className="btn btn-secondary justify-between">
              Tryout lagi <Icon.Arrow />
            </button>
            <Link href="/statistik" className="btn btn-secondary justify-between">
              Lihat statistik <Icon.Arrow />
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  /* ---------- Ujian / tinjau ---------- */
  const review = phase === "review" && result ? result.review[q.id] : null;
  const picked = state.answers[q.id];
  const flagged = !!state.flags[q.id];
  const last = state.idx === session.questions.length - 1;
  const low = phase === "exam" && leftRaw !== null && left <= 300;
  const explainReason = phase === "exam" ? "Bisa dipakai setelah tryout dikumpulkan, supaya kunci tidak bocor." : undefined;

  const timer = (
    <div
      role="timer"
      aria-label={`Sisa waktu ${fmt(left)}`}
      className={`flex items-center gap-2.5 rounded-none bg-accent px-3 py-2 text-on-accent md:px-3.5 ${low ? "anim-blink" : ""}`}
    >
      <span className="hidden text-[12px] font-medium tracking-[0.04em] uppercase md:inline">Sisa waktu</span>
      <span className="font-display text-[19px] font-medium tracking-[-0.02em] tabular-nums md:text-[22px]">{fmt(left)}</span>
    </div>
  );

  const panel = (
    <QuestionPanel
      groups={groups}
      view={view}
      setView={setView}
      state={state}
      result={phase === "review" ? result : null}
      counts={counts}
      onPick={(i) => {
        go(i);
        listRef.current?.close();
      }}
    />
  );

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Topbar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-bg px-5 py-3.5 md:px-10 md:py-[18px]">
        <div className="flex items-center gap-3 md:gap-5">
          <Link href="/" aria-label="Ambang — beranda" className="hidden md:block">
            <Logo />
          </Link>
          <LogoMark size={26} className="text-fg md:hidden" />
          <span className="hidden h-5 w-px bg-line md:block" />
          <span className="hidden text-[14px] font-medium text-muted md:inline">{config?.name ?? "Tryout SKD"}</span>
          <span className="font-display text-[16px] font-medium md:hidden">
            Soal {state.idx + 1}/{session.questions.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {phase === "exam" ? timer : <span className="rounded-none bg-accent px-3 py-2 font-display text-[19px] font-medium text-on-accent">{result?.breakdown.total}</span>}
          <span className="hidden md:inline-flex">
            {phase === "exam" ? (
              <button type="button" className="btn btn-secondary" onClick={() => confirmRef.current?.showModal()} disabled={busy}>
                {busy ? <Spinner /> : null} Selesai
              </button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={() => setPhase("result")}>
                Kembali ke hasil
              </button>
            )}
          </span>
        </div>
      </header>
      {/* Progres (mobile) */}
      <div className="h-[3px] bg-line md:hidden" aria-hidden>
        <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${((state.idx + 1) / session.questions.length) * 100}%` }} />
      </div>

      <div className="flex flex-1">
        <main className="flex min-w-0 flex-1 flex-col gap-5 px-5 pt-6 pb-32 md:gap-7 md:px-16 md:pt-12 md:pb-10">
          <div className="flex items-center gap-3.5">
            <span className="hidden font-display text-[14px] font-medium text-accent md:inline">
              Soal {state.idx + 1} dari {session.questions.length}
            </span>
            <span className="tag text-muted">{q.categoryName}</span>
            {phase === "review" && !picked && <span className="tag text-danger">Tidak dijawab</span>}
          </div>
          <h1 key={q.id} className="anim-fade-up max-w-[720px] font-display text-[26px] leading-[1.2] tracking-[-0.03em] whitespace-pre-line md:text-[38px]">
            {q.body}
          </h1>
          <div className="flex max-w-[720px] flex-col gap-2 md:gap-2.5" role="group" aria-label="Pilihan jawaban">
            {q.options.map((o) => (
              <OptionButton
                key={o.id}
                label={o.label}
                body={o.body}
                onClick={() => answer(o.id)}
                disabled={phase !== "exam"}
                state={review ? reviewState(q, o.label, picked, review.scores) : picked === o.id ? "selected" : "default"}
                score={review && q.type === "weighted" ? review.scores[o.label] : undefined}
              />
            ))}
          </div>

          {review && (
            <div className="anim-fade-up flex max-w-[720px] flex-col gap-3">
              <div className="card p-4 md:p-5">
                <p className="eyebrow">Pembahasan</p>
                <p className="mt-2 text-[15px] leading-[1.6]">{review.explanation || "Belum ada pembahasan singkat."}</p>
              </div>
              <AiPanel questionId={q.id} {...ai[q.id]} />
              <ReportButton questionId={q.id} kind="soal" />
            </div>
          )}

          {/* Jelaskan (mobile) */}
          <div className="flex max-w-[720px] flex-col gap-3 md:hidden">
            <ExplainButton full questionId={q.id} disabledReason={explainReason} onResult={(r) => setAi((x) => ({ ...x, [q.id]: r }))} />
            <p className="text-[12px] text-muted">{explainReason ?? "Penjelasan dibuat AI dan bisa keliru."}</p>
          </div>

          {error && <p className="max-w-[720px] text-[14px] text-danger">{error}</p>}

          <div className="hidden flex-1 md:block" />
          {/* Aksi (desktop) */}
          <div className="hidden max-w-[720px] items-center gap-3 md:flex">
            <button type="button" className="btn btn-secondary" onClick={() => go(state.idx - 1)} disabled={state.idx === 0}>
              Sebelumnya
            </button>
            {phase === "exam" && (
              <button type="button" aria-pressed={flagged} onClick={flag} className="btn btn-secondary py-3.5 pr-[18px] pl-4">
                <span className={`size-3.5 rounded-none border-[1.5px] border-accent transition-colors ${flagged ? "bg-accent" : ""}`} />
                Ragu-ragu
              </button>
            )}
            <div className="flex-1" />
            <ExplainButton questionId={q.id} disabledReason={explainReason} onResult={(r) => setAi((x) => ({ ...x, [q.id]: r }))} />
            <NextButton last={last} phase={phase} onNext={() => go(state.idx + 1)} onFinish={() => (phase === "exam" ? confirmRef.current?.showModal() : setPhase("result"))} />
          </div>
        </main>

        <aside className="hidden w-[380px] shrink-0 border-l border-line md:block">
          <div className="sticky top-[85px] flex h-[calc(100dvh-85px)] flex-col gap-[22px] overflow-y-auto p-10">{panel}</div>
        </aside>
      </div>

      {/* Bottom bar (mobile) */}
      <nav aria-label="Navigasi soal" className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-2 border-t border-line bg-bg px-5 pt-3.5 pb-[max(14px,env(safe-area-inset-bottom))] md:hidden">
        <button type="button" aria-label="Daftar soal" className="icon-btn size-12" onClick={() => listRef.current?.showModal()}>
          <Icon.Grid />
        </button>
        <button type="button" aria-label="Soal sebelumnya" className="icon-btn size-12" onClick={() => go(state.idx - 1)} disabled={state.idx === 0}>
          <Icon.Back />
        </button>
        {phase === "exam" && (
          <button type="button" aria-label={flagged ? "Hapus tanda ragu-ragu" : "Tandai ragu-ragu"} aria-pressed={flagged} className="icon-btn size-12" onClick={flag}>
            <span className={`size-4 rounded-none border-[1.5px] border-accent transition-colors ${flagged ? "bg-accent" : ""}`} />
          </button>
        )}
        <div className="flex-1">
          <NextButton full last={last} phase={phase} onNext={() => go(state.idx + 1)} onFinish={() => (phase === "exam" ? confirmRef.current?.showModal() : setPhase("result"))} />
        </div>
      </nav>

      {/* Daftar soal (mobile) */}
      <dialog ref={listRef} aria-label="Daftar soal" className="m-auto mb-0 w-full max-w-none rounded-none border border-line bg-bg p-5 text-fg" onClick={(e) => e.target === listRef.current && listRef.current?.close()}>
        <div className="mb-4 flex justify-end">
          <button type="button" aria-label="Tutup" className="icon-btn" onClick={() => listRef.current?.close()}>
            <Icon.Close />
          </button>
        </div>
        <div className="flex flex-col gap-5">{panel}</div>
        {phase === "exam" && (
          <button type="button" className="btn btn-primary mt-6 w-full" onClick={() => (listRef.current?.close(), confirmRef.current?.showModal())}>
            Kumpulkan tryout
          </button>
        )}
      </dialog>

      {/* Konfirmasi kumpulkan */}
      <dialog ref={confirmRef} aria-label="Kumpulkan tryout" className="m-auto w-[min(440px,calc(100vw-32px))] rounded-none border border-line bg-bg p-6 text-fg">
        <h2 className="font-display text-[26px] tracking-[-0.02em]">Kumpulkan sekarang?</h2>
        <p className="mt-3 text-[15px] leading-[1.55] text-muted">
          {counts.unanswered ? `${counts.unanswered} soal belum dijawab dan akan bernilai 0. ` : "Semua soal sudah dijawab. "}
          {counts.flagged ? `${counts.flagged} soal masih ditandai ragu-ragu. ` : ""}Sisa waktu {fmt(left)}.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-secondary" onClick={() => confirmRef.current?.close()}>
            Kembali
          </button>
          <button type="button" className="btn btn-accent" onClick={submit}>
            Kumpulkan <Icon.Arrow />
          </button>
        </div>
      </dialog>
    </div>
  );
}

function NextButton({ last, phase, onNext, onFinish, full }: { last: boolean; phase: Phase; onNext: () => void; onFinish: () => void; full?: boolean }) {
  return (
    <button type="button" onClick={last ? onFinish : onNext} className={`btn btn-accent ${full ? "w-full justify-between" : ""}`}>
      {last ? (phase === "exam" ? "Kumpulkan" : "Ke hasil") : "Berikutnya"} <Icon.Arrow />
    </button>
  );
}

function QuestionPanel({
  groups,
  view,
  setView,
  state,
  result,
  counts,
  onPick,
}: {
  groups: string[];
  view: string;
  setView: (g: string) => void;
  state: Saved;
  result: { review: Review } | null;
  counts: { answered: number; flagged: number; empty: number };
  onPick: (i: number) => void;
}) {
  const qs = state.session.questions;
  return (
    <>
      <h2 className="font-display text-[20px] tracking-[-0.02em]">Daftar soal</h2>
      <div className="flex rounded-none border border-line p-1" role="tablist" aria-label="Subtes">
        {groups.map((g) => (
          <button
            key={g}
            role="tab"
            type="button"
            aria-selected={view === g}
            onClick={() => setView(g)}
            className={`flex-1 rounded-none p-2 text-[13px] font-medium transition-colors duration-200 ${view === g ? "bg-fg text-bg" : "text-muted hover:text-fg"}`}
          >
            {g}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2" role="tabpanel">
        {qs.map((x, i) => {
          if (x.group !== view) return null;
          const current = i === state.idx;
          const answered = !!state.answers[x.id];
          const flagged = !!state.flags[x.id];
          let cls = "border border-line text-muted hover:border-fg hover:text-fg";
          if (result) {
            const sc = result.review[x.id]?.scores ?? {};
            const pickedLabel = x.options.find((o) => o.id === state.answers[x.id])?.label;
            const got = pickedLabel ? sc[pickedLabel] : 0;
            cls = !answered ? "border border-dashed border-line text-muted" : got === Math.max(...Object.values(sc)) ? "bg-fg text-bg" : "bg-surface border border-line text-fg";
          } else if (flagged) cls = "bg-accent text-on-accent";
          else if (answered) cls = "bg-fg text-bg";
          if (current) cls += answered || flagged ? " outline-2 outline-offset-2 outline-accent" : " !border-[1.5px] !border-accent !text-accent";
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => onPick(i)}
              aria-label={`Soal ${i + 1}${answered ? ", terjawab" : ""}${flagged ? ", ragu-ragu" : ""}`}
              aria-current={current ? "step" : undefined}
              className={`flex aspect-square items-center justify-center rounded-none text-[13px] font-medium transition-transform duration-150 hover:scale-110 ${cls}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      {result ? (
        <ul className="flex flex-col gap-2.5 text-[13px] text-muted">
          <li className="flex items-center gap-2.5"><span className="size-4 rounded-none bg-fg" /> Nilai penuh</li>
          <li className="flex items-center gap-2.5"><span className="size-4 rounded-none border border-line bg-surface" /> Kurang tepat</li>
          <li className="flex items-center gap-2.5"><span className="size-4 rounded-none border border-dashed border-line" /> Tidak dijawab</li>
        </ul>
      ) : (
        <ul className="flex flex-col gap-2.5 text-[13px] text-muted">
          <li className="flex items-center gap-2.5"><span className="size-4 rounded-none bg-fg" /> Terjawab · {counts.answered}</li>
          <li className="flex items-center gap-2.5"><span className="size-4 rounded-none bg-accent" /> Ragu-ragu · {counts.flagged}</li>
          <li className="flex items-center gap-2.5"><span className="size-4 rounded-none border border-line" /> Belum · {counts.empty}</li>
        </ul>
      )}
      <div className="hidden flex-1 md:block" />
      <div className="hidden flex-col gap-1.5 border-t border-line pt-4 md:flex">
        <p className="eyebrow">Pintasan keyboard</p>
        <p className="text-[13px] leading-[1.5]">A–E pilih jawaban · ← → pindah soal · R tandai ragu</p>
      </div>
    </>
  );
}

function Shell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-line px-5 py-3.5 md:px-10 md:py-[18px]">
        <Link href="/" aria-label="Ambang — beranda">
          <Logo />
        </Link>
        {right}
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
