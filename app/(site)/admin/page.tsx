"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CountUp } from "@/components/count-up";
import { Icon, Spinner, Tip } from "@/components/ui";
import { LESSONS } from "@/lib/excel-lessons";
import type { Breakdown } from "@/lib/scoring";
import { authedFetch, supabase, useRole, useUser } from "@/lib/supabase";

type Row = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  lastSignIn: string | null;
  practiceCount: number;
  tryoutCount: number;
  lastTotal: number | null;
  lastPassed: boolean | null;
  bestTotal: number | null;
  lastActivity: string | null;
};
type Detail = {
  user: { id: string; email: string; name: string; role: string; createdAt: string };
  attempts: { id: string; mode: "practice" | "tryout"; started_at: string; finished_at: string; score_breakdown: Breakdown | null }[];
  excel: { id: string; exercise_id: string; score: number; created_at: string }[];
};

const when = (s: string | null) =>
  s ? new Date(s).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const excelTitle = (id: string) => LESSONS.find((l) => l.exercise.id === id)?.title ?? id;

function randomPassword() {
  const abc = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint32Array(12)), (n) => abc[n % abc.length]).join("");
}

export default function AdminPage() {
  const user = useUser();
  const role = useRole(user);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);

  const load = useCallback(() => {
    authedFetch("/api/admin/users")
      .then((r) => setRows(r.users))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (role === "superadmin") load();
  }, [role, load]);

  const shown = useMemo(
    () => (rows ?? []).filter((r) => `${r.name} ${r.email}`.toLowerCase().includes(q.trim().toLowerCase())),
    [rows, q],
  );

  if (!supabase)
    return (
      <Gate title="Superadmin butuh Supabase." body="Isi env Supabase di .env.local, jalankan supabase/schema.sql, lalu buat superadmin dengan npm run create-superadmin." />
    );
  if (user === undefined || (user && role === null))
    return (
      <div className="flex justify-center py-24 text-muted">
        <Spinner />
      </div>
    );
  if (!user)
    return (
      <Gate title="Masuk sebagai superadmin." body="Halaman ini untuk mengelola akun dan melihat riwayat skor.">
        <Link href="/masuk" className="btn btn-primary self-start">
          Masuk <Icon.Arrow />
        </Link>
      </Gate>
    );
  if (role !== "superadmin") return <Gate title="Khusus superadmin." body={`Akun ${user.email} tidak punya akses ke halaman ini.`} />;

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-5 pt-6 pb-20 md:px-10 md:pt-10 xl:px-20">
      <div className="anim-fade-up flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Superadmin</p>
          <h1 className="mt-3 font-display text-[40px] leading-[1.05] tracking-[-0.03em] md:text-[52px]">Akun & riwayat skor.</h1>
        </div>
        <div className="grid grid-cols-3 border border-line">
          {[
            ["Akun", rows?.length ?? 0],
            ["Tryout", rows?.reduce((s, r) => s + r.tryoutCount, 0) ?? 0],
            ["Latihan", rows?.reduce((s, r) => s + r.practiceCount, 0) ?? 0],
          ].map(([k, v], i) => (
            <div key={k} className={`px-5 py-3 ${i ? "border-l border-line" : ""}`}>
              <p className="text-[12px] font-medium tracking-[0.06em] text-muted">{k}</p>
              <p className="font-display text-[28px] leading-tight">
                <CountUp value={Number(v)} />
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
        <div className="flex flex-col gap-6">
          <CreateUser onCreated={load} />
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[22px]">Daftar akun</h2>
              <button type="button" onClick={load} className="link text-[13px] text-muted hover:text-fg">
                Muat ulang
              </button>
            </div>
            <input className="field" placeholder="Cari nama atau email…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari akun" />
            {error && <p className="text-[14px] text-danger">{error}</p>}
            {!rows && !error && <Spinner />}
            <ul className="flex flex-col">
              {shown.map((r, i) => (
                <li key={r.id} className="anim-fade-up" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                  <button
                    type="button"
                    onClick={() => setSel(r.id)}
                    aria-pressed={sel === r.id}
                    className={`group flex w-full items-center gap-3 border-b border-line px-3 py-3 text-left transition-colors duration-200 ${
                      sel === r.id ? "inverse" : "hover:bg-surface"
                    }`}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center border border-line font-display text-[15px] uppercase transition-transform group-hover:scale-105">
                      {(r.name || r.email)[0]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 truncate font-medium">
                        {r.name || "(tanpa nama)"}
                        {r.role !== "user" && <span className="tag px-1.5 py-0.5 text-[11px]">{r.role}</span>}
                      </span>
                      <span className="block truncate text-[13px] text-muted">{r.email}</span>
                    </span>
                    <span className="text-right text-[12px] text-muted">
                      <span className={`block font-display text-[18px] ${r.lastPassed ? "text-accent-ink" : "text-fg"}`}>{r.lastTotal ?? "—"}</span>
                      {r.tryoutCount} tryout
                    </span>
                  </button>
                </li>
              ))}
              {rows && !shown.length && <li className="py-4 text-[14px] text-muted">Tidak ada akun yang cocok.</li>}
            </ul>
          </section>
        </div>

        <section className="min-w-0">{sel ? <UserDetail key={sel} id={sel} /> : <EmptyDetail />}</section>
      </div>
    </div>
  );
}

function CreateUser({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form
      className="card lift flex flex-col gap-3 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        try {
          await authedFetch("/api/admin/users", { method: "POST", body: JSON.stringify(form) });
          setMsg({ ok: true, text: `Akun ${form.email} dibuat. Kirimkan email dan kata sandi ini ke penggunanya: ${form.password}` });
          setForm({ name: "", email: "", password: "" });
          onCreated();
        } catch (err) {
          setMsg({ ok: false, text: (err as Error).message });
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="font-display text-[22px]">Tambah akun pengguna</h2>
      <label className="flex flex-col gap-1 text-[14px] font-medium">
        Nama
        <input className="field font-normal" required maxLength={80} value={form.name} onChange={set("name")} autoComplete="off" />
      </label>
      <label className="flex flex-col gap-1 text-[14px] font-medium">
        Email
        <input className="field font-normal" type="email" required value={form.email} onChange={set("email")} autoComplete="off" />
      </label>
      <label className="flex flex-col gap-1 text-[14px] font-medium">
        Kata sandi awal
        <span className="flex gap-2">
          <input className="field font-mono font-normal" required minLength={8} maxLength={72} value={form.password} onChange={set("password")} autoComplete="new-password" />
          <Tip label="Buat kata sandi acak 12 karakter">
            <button type="button" className="icon-btn shrink-0" aria-label="Buat kata sandi acak" onClick={() => setForm((f) => ({ ...f, password: randomPassword() }))}>
              <Icon.Sparkle />
            </button>
          </Tip>
        </span>
      </label>
      <button className="btn btn-primary justify-between" disabled={busy}>
        {busy && <Spinner />} Buat akun <Icon.Arrow />
      </button>
      {msg && (
        <p role="status" className={`anim-fade-up text-[14px] break-words ${msg.ok ? "" : "text-danger"}`}>
          {msg.text}
        </p>
      )}
    </form>
  );
}

function UserDetail({ id }: { id: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"tryout" | "practice" | "excel">("tryout");
  useEffect(() => {
    authedFetch(`/api/admin/users/${id}`)
      .then(setD)
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="text-danger">{error}</p>;
  if (!d)
    return (
      <div className="flex justify-center py-16 text-muted">
        <Spinner />
      </div>
    );

  const tryouts = d.attempts.filter((a) => a.mode === "tryout" && a.score_breakdown);
  const practices = d.attempts.filter((a) => a.mode === "practice" && a.score_breakdown);
  const totals = tryouts.map((t) => t.score_breakdown!.total);
  const stats = [
    ["Tryout", tryouts.length],
    ["Terbaik", totals.length ? Math.max(...totals) : 0],
    ["Rata-rata", totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0],
    ["Lewat ambang", tryouts.filter((t) => t.score_breakdown!.passed).length],
  ];

  return (
    <div className="anim-fade-up flex flex-col gap-6">
      <div>
        <p className="eyebrow">Detail akun</p>
        <h2 className="mt-2 font-display text-[32px] leading-tight">{d.user.name || d.user.email}</h2>
        <p className="text-[14px] text-muted">
          {d.user.email} · dibuat {when(d.user.createdAt)}
        </p>
      </div>
      <div className="grid grid-cols-2 border border-line md:grid-cols-4">
        {stats.map(([k, v], i) => (
          <div key={k} className={`px-4 py-3 ${i % 2 ? "border-l" : ""} ${i > 1 ? "border-t md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""} border-line`}>
            <p className="text-[12px] font-medium tracking-[0.06em] text-muted">{k}</p>
            <p className="font-display text-[28px] leading-tight">
              <CountUp value={Number(v)} />
            </p>
          </div>
        ))}
      </div>

      <div className="flex border border-line p-1" role="tablist" aria-label="Jenis riwayat">
        {(
          [
            ["tryout", `Tryout (${tryouts.length})`],
            ["practice", `Latihan (${practices.length})`],
            ["excel", `Excel (${d.excel.length})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`flex-1 px-3 py-2 text-[14px] font-medium transition-colors ${tab === k ? "bg-fg text-bg" : "text-muted hover:text-fg"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "excel" ? (
        <ul className="flex flex-col">
          {d.excel.map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-3 border-b border-line py-3 transition-colors hover:bg-surface">
              <span>
                <span className="block font-medium">{excelTitle(x.exercise_id)}</span>
                <span className="text-[13px] text-muted">{when(x.created_at)}</span>
              </span>
              <span className={`font-display text-[22px] ${x.score === 100 ? "text-accent-ink" : ""}`}>{Math.round(x.score)}%</span>
            </li>
          ))}
          {!d.excel.length && <li className="py-4 text-[14px] text-muted">Belum ada latihan Excel yang dinilai.</li>}
        </ul>
      ) : (
        <ul className="flex flex-col gap-3">
          {(tab === "tryout" ? tryouts : practices).map((a) => (
            <AttemptCard key={a.id} a={a} />
          ))}
          {!(tab === "tryout" ? tryouts : practices).length && <li className="py-4 text-[14px] text-muted">Belum ada riwayat.</li>}
        </ul>
      )}
    </div>
  );
}

function AttemptCard({ a }: { a: Detail["attempts"][number] }) {
  const b = a.score_breakdown!;
  const tryout = a.mode === "tryout";
  return (
    <li className="card lift flex flex-col gap-3 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-muted">{when(a.finished_at)}</span>
        <span className="flex items-center gap-2">
          {tryout && (
            <span className={`tag px-2 py-1 text-[11px] ${b.passed ? "border-accent bg-accent text-on-accent" : ""}`}>{b.passed ? "Lewat ambang" : "Belum lewat"}</span>
          )}
          <span className="font-display text-[26px] leading-none">{b.total}</span>
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {b.groups.map((g) => {
          const pct = (v: number) => `${g.max ? Math.min(100, (v / g.max) * 100) : 0}%`;
          return (
            <div key={g.code} className="grid grid-cols-[minmax(0,140px)_1fr_auto] items-center gap-3 text-[13px]">
              <span className="truncate">{g.code}</span>
              <span className="relative h-2 bg-line">
                <span className="anim-draw absolute inset-y-0 left-0 bg-fg" style={{ width: pct(g.score), animationDelay: "0s" }} />
                {g.passing !== undefined && <span className="absolute -top-1 h-4 w-0.5 bg-accent" style={{ left: pct(g.passing) }} />}
              </span>
              <span className="text-muted tabular-nums">
                {g.score}/{g.max}
                {g.passing !== undefined ? ` · ambang ${g.passing}` : ""}
              </span>
            </div>
          );
        })}
      </div>
    </li>
  );
}

function EmptyDetail() {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-start justify-center gap-2 border border-dashed border-line p-8">
      <p className="font-display text-[24px]">Pilih akun</p>
      <p className="text-[15px] text-muted">Riwayat tryout, latihan, dan nilai Excel pengguna tampil di sini.</p>
    </div>
  );
}

function Gate({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="anim-fade-up mx-auto flex max-w-[560px] flex-col gap-4 px-5 py-20">
      <h1 className="font-display text-[36px] leading-[1.1] tracking-[-0.03em]">{title}</h1>
      <p className="text-[16px] text-muted">{body}</p>
      {children}
    </div>
  );
}
