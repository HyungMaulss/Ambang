"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, Spinner } from "@/components/ui";
import { supabase, useUser } from "@/lib/supabase";

export default function MasukPage() {
  const user = useUser();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sandi" | "tautan">("sandi");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (user) router.replace("/latihan");
  }, [user, router]);

  if (!supabase)
    return (
      <div className="mx-auto max-w-[520px] px-5 py-20">
        <h1 className="font-display text-[36px] tracking-[-0.03em]">Login belum aktif</h1>
        <p className="mt-3 text-muted">
          Aplikasi berjalan dalam mode demo. Isi <code>NEXT_PUBLIC_SUPABASE_URL</code> dan <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> di <code>.env.local</code> untuk
          mengaktifkan login.
        </p>
      </div>
    );

  const redirectTo = typeof window !== "undefined" ? `${location.origin}/latihan` : undefined;

  return (
    <div className="mx-auto flex max-w-[460px] flex-col gap-8 px-5 py-14 md:py-20">
      <div className="anim-fade-up">
        <p className="eyebrow">Akun</p>
        <h1 className="mt-3 font-display text-[40px] leading-[1.05] tracking-[-0.03em]">Masuk ke Ambang</h1>
        <p className="mt-3 text-[15px] text-muted">Riwayat latihan, tryout, dan kuota pembahasan AI tersimpan per akun.</p>
      </div>

      {state === "sent" ? (
        <div className="anim-pop card p-5" role="status">
          <p className="font-medium">Cek email Anda.</p>
          <p className="mt-1 text-[14px] text-muted">Tautan masuk sudah dikirim ke {email}. Buka dari perangkat ini.</p>
        </div>
      ) : (
        <form
          className="anim-fade-up flex flex-col gap-3"
          style={{ animationDelay: "80ms" }}
          onSubmit={async (e) => {
            e.preventDefault();
            setState("sending");
            const { error } =
              mode === "sandi"
                ? await supabase!.auth.signInWithPassword({ email, password })
                : await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
            if (error) {
              setState("error");
              setMsg(/invalid login/i.test(error.message) ? "Email atau kata sandi salah." : error.message);
            } else setState(mode === "sandi" ? "idle" : "sent");
          }}
        >
          <div className="mb-2 flex border border-line p-1" role="tablist" aria-label="Cara masuk">
            {(["sandi", "tautan"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => (setMode(m), setState("idle"))}
                className={`flex-1 px-3 py-2 text-[14px] font-medium transition-colors ${mode === m ? "bg-fg text-bg" : "text-muted hover:text-fg"}`}
              >
                {m === "sandi" ? "Kata sandi" : "Tautan email"}
              </button>
            ))}
          </div>
          <label htmlFor="email" className="text-[14px] font-medium">
            Email
          </label>
          <input id="email" type="email" required autoComplete="email" className="field" placeholder="nama@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          {mode === "sandi" && (
            <>
              <label htmlFor="password" className="text-[14px] font-medium">
                Kata sandi
              </label>
              <input id="password" type="password" required minLength={8} autoComplete="current-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="text-[13px] text-muted">Akun dibuat oleh superadmin. Lupa kata sandi? Hubungi superadmin.</p>
            </>
          )}
          <button className="btn btn-primary justify-between" disabled={state === "sending"}>
            {state === "sending" ? <Spinner /> : null} {mode === "sandi" ? "Masuk" : "Kirim tautan masuk"} <Icon.Arrow />
          </button>
          {state === "error" && <p className="text-[14px] text-danger">{msg}</p>}
        </form>
      )}

      <div className="flex items-center gap-3 text-[13px] text-muted">
        <span className="h-px flex-1 bg-line" /> atau <span className="h-px flex-1 bg-line" />
      </div>
      <button
        type="button"
        className="btn btn-secondary justify-between"
        onClick={() => supabase!.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })}
      >
        Masuk dengan Google <Icon.Arrow />
      </button>
    </div>
  );
}
