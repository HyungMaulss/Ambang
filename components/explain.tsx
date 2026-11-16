"use client";

import { useState } from "react";
import { DEMO, explain, report } from "@/lib/bank";
import { supabase } from "@/lib/supabase";
import { Icon, Spinner, Tip } from "./ui";

/** D1/D5: tombol "Jelaskan lebih dalam" + label "Dibuat AI — bisa keliru" + lapor. */
export function ExplainButton({
  questionId,
  disabledReason,
  full,
  onResult,
}: {
  questionId: string;
  disabledReason?: string;
  full?: boolean;
  onResult: (r: { content?: string; error?: string }) => void;
}) {
  const [loading, setLoading] = useState(false);
  const reason = disabledReason ?? (DEMO ? "Pembahasan AI aktif setelah Supabase dan Gemini dikonfigurasi." : undefined);
  const run = async () => {
    setLoading(true);
    try {
      onResult({ content: (await explain(questionId)).content });
    } catch (e) {
      onResult({ error: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };
  return (
    <Tip label={reason ?? "Dibuat AI, bisa keliru. Hasil disimpan untuk semua."}>
      {/* span agar tooltip tetap muncul saat tombol nonaktif */}
      <span className={full ? "block w-full" : "inline-block"} tabIndex={reason ? 0 : -1}>
        <button
          type="button"
          onClick={run}
          disabled={!!reason || loading}
          className={`btn btn-secondary py-3.5 pr-[18px] pl-4 ${full ? "w-full" : ""} ${reason ? "pointer-events-none" : ""}`}
        >
          {loading ? <Spinner /> : <Icon.Sparkle className="transition-transform duration-500 group-hover:rotate-90" />}
          Jelaskan lebih dalam
        </button>
      </span>
    </Tip>
  );
}

export function AiPanel({ content, error, questionId }: { content?: string; error?: string; questionId: string }) {
  if (!content && !error) return null;
  return (
    <div className="anim-fade-up card p-4 md:p-5" role="status">
      {error ? (
        <p className="text-[14px] text-danger">{error}</p>
      ) : (
        <>
          <p className="eyebrow flex items-center gap-2">
            <Icon.Sparkle /> Dibuat AI — bisa keliru
          </p>
          <p className="mt-3 text-[15px] leading-[1.6] whitespace-pre-line">{content}</p>
          <div className="mt-3">
            <ReportButton questionId={questionId} kind="ai" />
          </div>
        </>
      )}
    </div>
  );
}

export function ReportButton({ questionId, kind }: { questionId: string; kind: "soal" | "ai" }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");
  if (!supabase || questionId.startsWith("demo-") || questionId.startsWith("local-")) return null;
  if (state === "sent") return <p className="text-[13px] text-muted">Terima kasih, laporan terkirim ke admin.</p>;
  const label = kind === "ai" ? "Laporkan penjelasan" : "Laporkan soal salah";
  return open ? (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await report(questionId, kind, note);
          setState("sent");
        } catch {
          setState("error");
          setMsg("Gagal mengirim. Pastikan Anda sudah masuk.");
        }
      }}
    >
      <input className="field text-[14px]" placeholder="Apa yang salah? (opsional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} autoFocus />
      <button className="btn btn-secondary py-2.5 text-[14px]">Kirim</button>
      {state === "error" && <p className="text-[13px] text-danger">{msg}</p>}
    </form>
  ) : (
    <button type="button" onClick={() => setOpen(true)} className="link text-[13px] text-muted hover:text-fg">
      {label}
    </button>
  );
}
