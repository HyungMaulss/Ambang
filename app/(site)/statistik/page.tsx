"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon, Spinner, Tip } from "@/components/ui";
import { DEMO, listAttempts, type Attempt } from "@/lib/bank";
import { supabase, useUser } from "@/lib/supabase";

const date = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

export default function StatistikPage() {
  const user = useUser();
  const [rows, setRows] = useState<Attempt[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (supabase && !user) return;
    listAttempts().then(setRows).catch((e) => setError(e.message));
  }, [user]);

  const tryouts = useMemo(() => (rows ?? []).filter((r) => r.mode === "tryout" && r.score_breakdown).reverse(), [rows]);
  const weakest = useMemo(() => {
    const agg = new Map<string, { score: number; max: number; n: number }>();
    for (const r of rows ?? []) {
      if (r.mode !== "practice") continue;
      for (const g of r.score_breakdown?.groups ?? []) {
        const a = agg.get(g.code) ?? { score: 0, max: 0, n: 0 };
        agg.set(g.code, { score: a.score + g.score, max: a.max + g.max, n: a.n + g.total });
      }
    }
    return [...agg.entries()].map(([code, a]) => ({ code, pct: a.max ? a.score / a.max : 0, n: a.n })).sort((a, b) => a.pct - b.pct);
  }, [rows]);
  const latest = tryouts[tryouts.length - 1];
  const maxTotal = Math.max(1, ...tryouts.map((t) => t.score_breakdown!.groups.reduce((s, g) => s + g.max, 0)));

  if (supabase && user === null)
    return (
      <Empty title="Masuk untuk melihat statistik." body="Riwayat latihan dan tryout disimpan per akun.">
        <Link href="/masuk" className="btn btn-primary">
          Masuk <Icon.Arrow />
        </Link>
      </Empty>
    );
  if (!rows && !error)
    return (
      <div className="flex justify-center py-24 text-muted">
        <Spinner />
      </div>
    );
  if (rows && !rows.length)
    return (
      <Empty title="Belum ada riwayat." body="Selesaikan satu latihan atau tryout, lalu kembali ke sini.">
        <Link href="/latihan" className="btn btn-primary">
          Mulai latihan <Icon.Arrow />
        </Link>
      </Empty>
    );

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-12 px-5 pt-6 pb-20 md:px-10 md:pt-10 xl:px-20">
      <div className="anim-fade-up">
        <p className="eyebrow">Statistik{DEMO ? " · mode demo (perangkat ini)" : ""}</p>
        <h1 className="mt-3 font-display text-[40px] leading-[1.05] tracking-[-0.03em] md:text-[56px]">Jarak ke ambang.</h1>
      </div>
      {error && <p className="text-danger">{error}</p>}

      {latest && (
        <section className="grid gap-px overflow-hidden rounded-[8px] border border-line bg-line md:grid-cols-3">
          {latest.score_breakdown!.groups.map((g, i) => {
            const gap = (g.passing ?? 0) - g.score;
            return (
              <div key={g.code} className="anim-fade-up flex flex-col gap-1 bg-bg p-5 transition-colors hover:bg-surface" style={{ animationDelay: `${i * 80}ms` }}>
                <span className="text-[12px] font-medium tracking-[0.06em] text-muted">{g.code} · tryout terakhir</span>
                <span className="font-display text-[44px] leading-none tracking-[-0.03em]">{g.score}</span>
                <span className={`text-[14px] ${gap > 0 ? "text-muted" : "font-medium"}`}>
                  {g.passing === undefined ? `dari ${g.max}` : gap > 0 ? `${gap} poin lagi ke ambang ${g.passing}` : `Lewat ambang ${g.passing}`}
                </span>
              </div>
            );
          })}
        </section>
      )}

      <section className="flex flex-col gap-5">
        <h2 className="font-display text-[26px] tracking-[-0.02em]">Tren tryout</h2>
        {tryouts.length ? (
          <div className="flex h-56 items-end gap-2 border-b border-line pb-0 md:gap-3" role="list" aria-label="Total skor per tryout">
            {tryouts.slice(-20).map((t, i) => {
              const b = t.score_breakdown!;
              return (
                <Tip key={t.id} label={`${date(t.started_at)} · total ${b.total} · ${b.passed ? "lewat ambang" : "belum lewat"}`}>
                  <div role="listitem" tabIndex={0} className="group flex h-full max-w-14 flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-[12px] text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100">{b.total}</span>
                    <div
                      className={`anim-rise w-full transition-colors ${b.passed ? "bg-accent" : "bg-fg group-hover:bg-muted"}`}
                      style={{ height: `${(b.total / maxTotal) * 85}%`, animationDelay: `${i * 50}ms` }}
                    />
                  </div>
                </Tip>
              );
            })}
          </div>
        ) : (
          <p className="text-muted">
            Belum ada tryout.{" "}
            <Link className="text-fg underline" href="/tryout">
              Coba tryout
            </Link>
          </p>
        )}
        <p className="text-[13px] text-muted">Batang kuning = lewat ambang batas di semua subtes.</p>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="font-display text-[26px] tracking-[-0.02em]">Subkategori terlemah (latihan)</h2>
        {weakest.length ? (
          <div className="flex flex-col gap-4">
            {weakest.map((w, i) => (
              <div key={w.code} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-[14px]">
                  <span className={i === 0 ? "font-medium" : ""}>
                    {w.code}
                    {i === 0 && weakest.length > 1 ? " · paling perlu dilatih" : ""}
                  </span>
                  <span className="text-muted">
                    {Math.round(w.pct * 100)}% · {w.n} soal
                  </span>
                </div>
                <div className="h-2 bg-line">
                  <div className="anim-draw h-full bg-fg" style={{ width: `${w.pct * 100}%`, animationDelay: `${i * 80}ms` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted">Belum ada latihan tersimpan.</p>
        )}
      </section>
    </div>
  );
}

function Empty({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="anim-fade-up mx-auto flex max-w-[560px] flex-col items-start gap-4 px-5 py-20">
      <h1 className="font-display text-[36px] leading-[1.1] tracking-[-0.03em]">{title}</h1>
      <p className="text-[16px] text-muted">{body}</p>
      {children}
    </div>
  );
}
