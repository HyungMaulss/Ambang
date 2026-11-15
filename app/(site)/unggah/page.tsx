"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PracticeSession } from "@/components/practice";
import { Icon, LABELS, Spinner } from "@/components/ui";
import { getCategories, savePrivateQuestions, type Category, type Question } from "@/lib/bank";
import { parseSoal, type ParsedQuestion } from "@/lib/parse-soal";
import { supabase, useUser } from "@/lib/supabase";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PAGES = 30;

// E2/E4: file dibaca dan dikonversi di browser saja. Tidak ada upload; buffer dibuang setelah teks diambil.
async function extractText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  if (/\.docx$/i.test(file.name)) {
    const mammoth = (await import("mammoth")).default;
    return (await mammoth.extractRawText({ arrayBuffer: buf })).value;
  }
  if (/\.pdf$/i.test(file.name)) {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
    const task = pdfjs.getDocument({ data: new Uint8Array(buf) });
    const doc = await task.promise;
    const pages = doc.numPages;
    let text = "";
    try {
      if (pages > MAX_PAGES) throw new Error(`PDF ${pages} halaman. Maksimal ${MAX_PAGES} halaman agar HP tidak macet.`);
      for (let p = 1; p <= pages; p++) {
        const content = await (await doc.getPage(p)).getTextContent();
        for (const it of content.items) if ("str" in it) text += it.str + (it.hasEOL ? "\n" : "");
        text += "\n";
      }
    } finally {
      await task.destroy();
    }
    // E7: PDF hasil scan hampir tidak punya lapisan teks.
    if (text.replace(/\s/g, "").length < 20 * pages) throw new Error("PDF ini sepertinya hasil scan (gambar). OCR belum didukung; pakai .docx atau PDF berbasis teks.");
    return text;
  }
  throw new Error("Format tidak didukung. Pakai .docx atau .pdf.");
}

const toQuestion = (p: ParsedQuestion, i: number): Question => ({
  id: `local-${i}`,
  category: "LOCAL",
  group: "Unggahan",
  categoryName: p.type === "weighted" ? "Unggahan · TKP" : "Unggahan",
  type: p.type,
  body: p.body,
  explanation: p.explanation,
  options: p.options.map((o) => ({ id: `local-${i}-${o.label}`, ...o })),
});

export default function UnggahPage() {
  const user = useUser();
  const [items, setItems] = useState<ParsedQuestion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [practice, setPractice] = useState<Question[] | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [cat, setCat] = useState("");
  const [submitReview, setSubmitReview] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    if (supabase) getCategories().then((c) => setCats(c.filter((x) => x.parent_id))).catch(() => {});
  }, []);

  const onFile = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = ""; // lepas referensi file
    if (!file) return;
    setError("");
    setSaved("");
    if (file.size > MAX_BYTES) return setError("Ukuran file lebih dari 5 MB.");
    setBusy(true);
    try {
      const parsed = parseSoal(await extractText(file));
      if (!parsed.length) throw new Error("Tidak ada baris “Soal:” yang ditemukan. Pastikan dokumen mengikuti template.");
      setItems(parsed);
      setFileName(file.name);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const update = (i: number, fn: (p: ParsedQuestion) => ParsedQuestion) =>
    setItems((xs) => xs!.map((x, j) => (j === i ? revalidate(fn(x)) : x)));
  const valid = (items ?? []).filter((x) => !x.errors.length);

  if (practice)
    return (
      <div className="pt-4 md:pt-8">
        <PracticeSession local questions={practice} onExit={() => setPractice(null)} />
      </div>
    );

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-8 px-5 pt-6 pb-20 md:pt-10">
      <div className="anim-fade-up">
        <p className="eyebrow">Unggah soal</p>
        <h1 className="mt-3 font-display text-[40px] leading-[1.05] tracking-[-0.03em] md:text-[56px]">Word/PDF jadi latihan.</h1>
        <p className="mt-4 max-w-[600px] text-[16px] leading-[1.55] text-muted">
          File dibaca dan dikonversi <strong className="text-fg">di browser Anda</strong>. File tidak pernah dikirim ke server dan tidak disimpan. Yang
          bisa disimpan hanya teks soal hasil konversi, dan itu pun bila Anda memilihnya.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <a href="/template-soal-ambang.docx" download className="card group flex items-center justify-between gap-4 p-5 transition-colors hover:border-fg">
          <span>
            <span className="block font-medium">1. Unduh template .docx</span>
            <span className="text-[14px] text-muted">Format: Soal:, A.–E., Kunci: atau Bobot:, Pembahasan:</span>
          </span>
          <Icon.ArrowLg className="arrow shrink-0 transition-transform group-hover:translate-y-0.5 group-hover:rotate-90" />
        </a>
        <label className="card group flex cursor-pointer items-center justify-between gap-4 p-5 transition-colors hover:border-fg focus-within:border-fg">
          <span>
            <span className="block font-medium">2. Pilih file .docx atau .pdf</span>
            <span className="text-[14px] text-muted">Maks. 5 MB / 30 halaman. PDF scan tidak didukung.</span>
          </span>
          {busy ? <Spinner /> : <Icon.ArrowLg className="arrow shrink-0 transition-transform group-hover:translate-x-1" />}
          <input type="file" accept=".docx,.pdf" className="sr-only" onChange={(e) => onFile(e.currentTarget)} disabled={busy} />
        </label>
      </div>
      {error && <p className="text-[14px] text-danger" role="alert">{error}</p>}

      {items && (
        <section className="flex flex-col gap-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
            <h2 className="font-display text-[26px] tracking-[-0.02em]">Pratinjau · {fileName}</h2>
            <span className="text-[14px] text-muted">
              {valid.length} siap dari {items.length} soal
            </span>
          </div>
          {items.map((p, i) => (
            <PreviewCard key={i} n={i + 1} p={p} onChange={(fn) => update(i, fn)} onRemove={() => setItems((xs) => xs!.filter((_, j) => j !== i))} />
          ))}

          <div className="card sticky bottom-3 flex flex-col gap-4 p-4 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.35)] md:p-5">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <button type="button" disabled={!valid.length} onClick={() => setPractice(valid.map(toQuestion))} className="btn btn-accent justify-between">
                Latihan sekali pakai <Icon.Arrow />
              </button>
              <span className="text-[13px] text-muted">Hanya di memori browser, hilang saat tab ditutup.</span>
            </div>
            {supabase && user ? (
              <div className="flex flex-col gap-2.5 border-t border-line pt-4 md:flex-row md:items-center">
                <select className="field md:w-64" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Subkategori soal">
                  <option value="">Pilih subkategori…</option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.parent_id} · {c.name}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-[14px]">
                  <input type="checkbox" checked={submitReview} onChange={(e) => setSubmitReview(e.target.checked)} className="size-4 accent-[var(--accent)]" />
                  Ajukan ke bank publik (ditinjau admin)
                </label>
                <button
                  type="button"
                  disabled={!valid.length || !cat || busy}
                  className="btn btn-primary justify-between md:ml-auto"
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      await savePrivateQuestions(valid, cat, submitReview);
                      setSaved(`${valid.length} soal tersimpan sebagai soal pribadi${submitReview ? " dan diajukan ke admin" : ""}.`);
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Simpan ke akun <Icon.Arrow />
                </button>
              </div>
            ) : (
              <p className="border-t border-line pt-4 text-[13px] text-muted">
                {supabase ? (
                  <>
                    <Link href="/masuk" className="text-fg underline">
                      Masuk
                    </Link>{" "}
                    untuk menyimpan soal ke akun.
                  </>
                ) : (
                  "Mode demo: simpan ke akun aktif setelah Supabase dikonfigurasi."
                )}
              </p>
            )}
            {saved && <p className="anim-fade-up text-[14px] font-medium" role="status">{saved}</p>}
          </div>
        </section>
      )}
    </div>
  );
}

function revalidate(p: ParsedQuestion): ParsedQuestion {
  const errors: string[] = [];
  if (!p.body.trim()) errors.push("Teks soal kosong.");
  if (p.options.length !== 5 || p.options.some((o) => !o.body.trim())) errors.push("Isi kelima opsi A–E.");
  if (p.type === "single" && p.options.filter((o) => o.score === 5).length !== 1) errors.push("Pilih satu kunci.");
  if (p.type === "weighted" && p.options.some((o) => o.score < 1 || o.score > 5)) errors.push("Bobot TKP harus 1–5.");
  return { ...p, errors };
}

function PreviewCard({ n, p, onChange, onRemove }: { n: number; p: ParsedQuestion; onChange: (fn: (p: ParsedQuestion) => ParsedQuestion) => void; onRemove: () => void }) {
  const opts = LABELS.map((l) => p.options.find((o) => o.label === l) ?? { label: l, body: "", score: 0 });
  const setOpt = (label: string, patch: Partial<{ body: string; score: number }>) =>
    onChange((x) => ({ ...x, options: opts.map((o) => (o.label === label ? { ...o, ...patch } : o)) }));
  return (
    <div className={`anim-fade-up flex flex-col gap-3 rounded-[8px] border p-4 md:p-5 ${p.errors.length ? "border-danger/60" : "border-line"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-[14px] font-medium text-muted">
          Soal {n} · {p.type === "weighted" ? "TKP berbobot" : "satu kunci"}
          {p.needsImage && <span className="ml-2 text-danger">· butuh gambar, isi manual</span>}
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-[13px] text-muted underline underline-offset-2 hover:text-fg"
            onClick={() => onChange((x) => ({ ...x, type: x.type === "single" ? "weighted" : "single", options: opts.map((o) => ({ ...o, score: x.type === "single" ? 3 : 0 })) }))}
          >
            Ubah ke {p.type === "single" ? "TKP" : "satu kunci"}
          </button>
          <button type="button" aria-label={`Hapus soal ${n}`} className="icon-btn size-9" onClick={onRemove}>
            <Icon.Close />
          </button>
        </div>
      </div>
      <textarea className="field min-h-20" value={p.body} onChange={(e) => onChange((x) => ({ ...x, body: e.target.value }))} aria-label={`Teks soal ${n}`} />
      <div className="flex flex-col gap-2">
        {opts.map((o) => (
          <div key={o.label} className="flex items-center gap-2">
            {p.type === "single" ? (
              <button
                type="button"
                aria-label={`Jadikan ${o.label} kunci`}
                aria-pressed={o.score === 5}
                onClick={() => onChange((x) => ({ ...x, options: opts.map((y) => ({ ...y, score: y.label === o.label ? 5 : 0 })) }))}
                className={`flex size-9 shrink-0 items-center justify-center rounded-[4px] border font-display text-[14px] transition-colors ${
                  o.score === 5 ? "border-accent bg-accent text-on-accent" : "border-line hover:border-fg"
                }`}
              >
                {o.label}
              </button>
            ) : (
              <select
                aria-label={`Bobot ${o.label}`}
                value={o.score}
                onChange={(e) => setOpt(o.label, { score: Number(e.target.value) })}
                className="field w-16 shrink-0 px-2"
              >
                {[0, 1, 2, 3, 4, 5].map((v) => (
                  <option key={v} value={v}>
                    {o.label}={v || "?"}
                  </option>
                ))}
              </select>
            )}
            <input className="field" value={o.body} onChange={(e) => setOpt(o.label, { body: e.target.value })} aria-label={`Opsi ${o.label} soal ${n}`} />
          </div>
        ))}
      </div>
      <input
        className="field text-[14px]"
        placeholder="Pembahasan (opsional)"
        value={p.explanation}
        onChange={(e) => onChange((x) => ({ ...x, explanation: e.target.value }))}
        aria-label={`Pembahasan soal ${n}`}
      />
      {p.errors.length > 0 && <p className="text-[13px] text-danger">{p.errors.join(" ")}</p>}
    </div>
  );
}
