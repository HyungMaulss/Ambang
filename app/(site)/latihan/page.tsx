"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PracticeSession } from "@/components/practice";
import { Icon, Spinner, Tip } from "@/components/ui";
import { DEMO, getCategories, practiceSet, storage, type Category, type Question } from "@/lib/bank";
import { supabase, useUser } from "@/lib/supabase";

const COUNTS = [5, 10, 20];

export default function LatihanPage() {
  const user = useUser();
  const [cats, setCats] = useState<Category[]>([]);
  const [sel, setSel] = useState("TWK");
  const [count, setCount] = useState(10);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [guestUsed, setGuestUsed] = useState(false);

  useEffect(() => {
    getCategories().then(setCats).catch((e) => setError(e.message));
    setGuestUsed(storage.get("ambang:guest-used", false));
  }, []);

  const isGuest = !!supabase && user === null;
  const blocked = isGuest && guestUsed;
  const parents = cats.filter((c) => !c.parent_id);

  const start = async () => {
    setLoading(true);
    setError("");
    try {
      const qs = await practiceSet(sel, count);
      if (!qs.length) throw new Error("Belum ada soal terbit di kategori ini.");
      if (isGuest) storage.set("ambang:guest-used", true);
      setQuestions(qs);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (questions)
    return (
      <div className="pt-4 md:pt-8">
        <PracticeSession questions={questions} onExit={() => setQuestions(null)} />
      </div>
    );

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-5 pt-6 pb-20 md:px-10 md:pt-10 xl:px-20">
      <div className="anim-fade-up flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Mode latihan</p>
          <h1 className="mt-3 font-display text-[40px] leading-[1.05] tracking-[-0.03em] md:text-[56px]">Pilih kategori.</h1>
        </div>
        <p className="max-w-[420px] text-[16px] leading-[1.55] text-muted">
          Pembahasan muncul langsung setelah Anda menjawab. Soal TKP dinilai berbobot 1–5, bukan benar-salah.
        </p>
      </div>

      {DEMO && (
        <p className="card px-4 py-3 text-[14px] text-muted">
          <strong className="text-fg">Mode demo.</strong> Supabase belum dikonfigurasi, jadi yang tampil adalah soal contoh orisinal dan riwayat disimpan di
          perangkat ini saja.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[...parents, ...(user ? [{ id: "PRIBADI", parent_id: null, name: "Soal pribadi saya", tooltip_text: "Soal yang Anda simpan dari unggahan Word/PDF." }] : [])].map(
          (p, i) => {
            const subs = cats.filter((c) => c.parent_id === p.id);
            const active = sel === p.id || subs.some((s) => s.id === sel);
            return (
              <div
                key={p.id}
                style={{ animationDelay: `${i * 60}ms` }}
                className={`anim-fade-up flex flex-col gap-4 rounded-none border p-5 transition-all duration-300 ${
                  active ? "inverse border-transparent" : "lift border-line"
                }`}
              >
                <button type="button" onClick={() => setSel(p.id)} className="flex items-start justify-between gap-3 text-left" aria-pressed={sel === p.id}>
                  <span>
                    <span className={`font-display text-[14px] font-medium ${active ? "text-accent" : "text-muted"}`}>{p.id === "PRIBADI" ? "Unggahan" : p.id}</span>
                    <span className="mt-1 block font-display text-[22px] leading-tight tracking-[-0.02em]">{p.name}</span>
                  </span>
                  <span className={`mt-1 size-4 shrink-0 rounded-full border-2 transition-colors ${sel === p.id ? "border-accent bg-accent" : "border-line"}`} />
                </button>
                {p.tooltip_text && <p className="text-[14px] leading-[1.5] text-muted">{p.tooltip_text}</p>}
                {subs.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {subs.map((s) => (
                      <Tip key={s.id} label={s.tooltip_text ?? s.name}>
                        <button
                          type="button"
                          onClick={() => setSel(s.id)}
                          aria-pressed={sel === s.id}
                          className={`tag transition-colors ${sel === s.id ? "border-accent bg-accent text-on-accent" : "hover:border-fg"}`}
                        >
                          {s.name}
                        </button>
                      </Tip>
                    ))}
                  </div>
                )}
              </div>
            );
          },
        )}
        {!cats.length && !error && (
          <p className="flex items-center gap-2 text-muted">
            <Spinner /> Memuat kategori…
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4 border-t border-line pt-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[14px] text-muted">Jumlah soal</span>
          <div className="flex rounded-none border border-line p-1" role="radiogroup" aria-label="Jumlah soal">
            {COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={count === n}
                onClick={() => setCount(n)}
                className={`min-w-12 rounded-none px-3 py-2 text-[14px] font-medium transition-colors ${count === n ? "bg-fg text-bg" : "text-muted hover:text-fg"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <Link href="/unggah" className="link text-[14px] text-muted hover:text-fg">
            Punya soal sendiri? Unggah Word/PDF
          </Link>
          <button type="button" onClick={start} disabled={loading || blocked || !cats.length} className="btn btn-primary justify-between">
            {loading ? <Spinner /> : null} Mulai latihan <Icon.Arrow />
          </button>
        </div>
      </div>
      {blocked && (
        <p className="text-[14px] text-muted">
          Latihan tamu sudah dipakai.{" "}
          <Link href="/masuk" className="text-fg underline">
            Masuk
          </Link>{" "}
          untuk lanjut dan menyimpan riwayat.
        </p>
      )}
      {isGuest && !blocked && <p className="text-[14px] text-muted">Mode tamu: satu latihan gratis tanpa login, riwayat tidak disimpan.</p>}
      {error && <p className="text-[14px] text-danger">{error}</p>}
    </div>
  );
}
