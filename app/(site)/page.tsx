import Link from "next/link";
import { CountUp } from "@/components/count-up";
import { Reveal } from "@/components/reveal";
import { Tilt } from "@/components/tilt";
import { Icon, Term } from "@/components/ui";
import { Modules } from "./modules";
import config from "@/data/soal-contoh.json";

const PG = config.examConfig.passing_grade as Record<string, number>;
const TERMS: Record<string, string> = {
  TWK: "Tes Wawasan Kebangsaan — 30 soal, nilai benar 5, salah 0.",
  TIU: "Tes Intelegensia Umum — 35 soal, nilai benar 5, salah 0.",
  TKP: "Tes Karakteristik Pribadi — 45 soal, tiap opsi bernilai 1–5, tidak ada jawaban salah.",
};

function Connector() {
  return (
    <svg className="connector h-[22px] w-full md:h-[26px]" viewBox="0 0 426.667 25" preserveAspectRatio="none" fill="none" aria-hidden>
      <path d="M0 24.5H170.266C215.336 24.5 225.352 0.5 270.423 0.5H426.667" stroke="var(--line)" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* Visual hero: batang TWK/TIU/TKP tumbuh melewati garis ambang (Figma 5:75). */
function ThresholdVisual() {
  const bars = [
    { code: "TWK", h: "67%" },
    { code: "TIU", h: "83%" },
    { code: "TKP", h: "74%" },
  ];
  return (
    <div className="relative h-[300px] overflow-hidden md:h-[640px]" aria-hidden>
      {[34, 59, 84, 110].map((s, i) => (
        <div
          key={s}
          className="absolute top-[51%] left-1/2 -translate-1/2"
          style={{ height: `${s}%`, aspectRatio: 1 }}
        >
          <div className="anim-ring size-full rounded-full border border-line" style={{ animationDelay: `${i * 0.8}s` }} />
        </div>
      ))}
      <div className="absolute inset-0 flex items-end justify-center gap-2 md:gap-8">
        {bars.map((b, i) => (
          <div key={b.code} className="group relative flex h-full w-8 items-end md:w-11">
            <div
              className="anim-rise relative w-full bg-fg transition-[filter,transform] duration-300 group-hover:brightness-75"
              style={{ height: b.h, animationDelay: `${0.15 + i * 0.12}s` }}
            >
              <span className="absolute -top-6 left-0 text-[12px] font-medium tracking-[0.06em]">{b.code}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="anim-draw absolute inset-x-0 top-[47%] h-1 bg-accent md:h-1.5" />
      <span className="eyebrow absolute top-[calc(47%-22px)] left-3 text-[11px] md:left-0 md:text-[12px]">ambang batas</span>
      <div className="anim-float absolute right-0 bottom-[72px] hidden md:block">
        <Tilt className="card w-[238px] p-[18px] shadow-[0_12px_32px_-16px_rgb(0_0_0/0.35)]">
          <p className="text-[12px] font-medium text-muted">Soal 12 · TIU Numerik</p>
          <p className="mt-3 text-[15px] leading-[1.4] font-medium">Jika 3x + 7 = 25, berapakah nilai 2x − 4?</p>
          <span className="mt-3 inline-block bg-accent px-2.5 py-[7px] text-[12px] font-medium text-on-accent">Jelaskan lebih dalam</span>
        </Tilt>
      </div>
    </div>
  );
}

export default function Beranda() {
  const steps = [
    ["01", "Pilih kategori", "TWK, TIU, TKP, atau soal pribadi hasil konversi Word/PDF."],
    ["02", "Kerjakan & cek", "Mode latihan langsung dinilai, atau tryout 110 soal bertimer."],
    ["03", "Pahami pembahasan", "Pembahasan singkat di tiap soal, AI untuk penjelasan yang lebih dalam."],
  ];
  const ribbon = ["Tes Wawasan Kebangsaan", "Tes Intelegensia Umum", "Tes Karakteristik Pribadi", "Excel Lab", "Tryout 100 menit"];

  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-[1440px] gap-12 px-5 pt-8 md:px-10 md:pt-14 lg:grid-cols-[620px_1fr] xl:px-20">
        <div className="flex flex-col justify-between gap-12 lg:h-[640px]">
          <div className="flex flex-col gap-6 md:gap-7">
            <p className="anim-fade-up flex items-center gap-2.5 text-[13px] font-medium tracking-[0.08em] text-muted uppercase">
              <span className="anim-blink size-2 bg-accent" />
              SKD CPNS &amp; Excel Lab
            </p>
            <h1
              className="anim-fade-up font-display text-[48px] leading-none tracking-[-0.04em] md:text-[84px]"
              style={{ animationDelay: "80ms" }}
            >
              Latihan sampai
              <br />
              lewat{" "}
              <span className="group inline-block rounded-none bg-accent px-2 pb-1 text-on-accent transition-transform duration-300 hover:-rotate-2 md:px-3.5">
                ambang.
              </span>
            </h1>
            <p className="anim-fade-up max-w-[500px] text-[16px] leading-[1.55] text-muted md:text-[18px]" style={{ animationDelay: "160ms" }}>
              Bank soal TWK, TIU, dan TKP dengan pembahasan, tryout bertimer 100 menit, dan lab rumus Excel. Gratis, untuk belajar mandiri bersama
              teman.
            </p>
            <div className="anim-fade-up flex flex-col gap-2.5 sm:flex-row sm:gap-3" style={{ animationDelay: "240ms" }}>
              <Link href="/latihan" className="btn btn-primary justify-between sm:justify-center">
                Mulai latihan <Icon.Arrow />
              </Link>
              <Link href="/tryout" className="btn btn-secondary justify-between sm:justify-center">
                Coba tryout <Icon.Arrow />
              </Link>
            </div>
          </div>

          <div className="hidden lg:block">
            <Thresholds />
          </div>
        </div>
        <ThresholdVisual />
        <div className="lg:hidden">
          <Thresholds />
        </div>
      </section>

      {/* Langkah */}
      <section className="mx-auto grid max-w-[1440px] gap-7 px-5 pt-10 pb-14 md:grid-cols-3 md:gap-0 md:px-10 md:pt-12 md:pb-24 xl:px-20">
        {steps.map(([n, t, d], i) => (
          <Reveal key={n} delay={i * 120} className="flex flex-col gap-3 md:gap-4">
            <Connector />
            <h3 className="flex items-center gap-3">
              <span className="font-display text-[14px] font-medium text-muted">{n}</span>
              <span className="font-display text-[22px] tracking-[-0.02em]">{t}</span>
            </h3>
            <p className="max-w-[340px] text-[15px] leading-[1.5] text-muted">{d}</p>
          </Reveal>
        ))}
      </section>

      {/* Pita kategori — marquee, berhenti saat hover */}
      <div className="inverse overflow-hidden py-[18px] md:py-6" aria-label="Kategori latihan">
        <div className="marquee flex w-max">
          {[0, 1].map((k) => (
            <div key={k} className="flex shrink-0 items-center gap-6 pr-6 md:gap-9 md:pr-9" aria-hidden={k === 1}>
              {ribbon.map((r) => (
                <span key={r} className="flex items-center gap-6 md:gap-9">
                  <span className="font-display text-[22px] tracking-[-0.02em] whitespace-nowrap md:text-[30px]">{r}</span>
                  <span className="size-2 bg-accent md:size-2.5" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Modul */}
      <section className="mx-auto flex max-w-[1440px] flex-col gap-7 px-5 py-14 md:gap-12 md:px-10 md:py-24 xl:px-20">
        <Reveal className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <h2 className="font-display text-[36px] leading-[1.05] tracking-[-0.03em] md:text-[56px]">
            Empat modul,
            <br />
            satu tujuan.
          </h2>
          <p className="max-w-[380px] text-[16px] leading-[1.55] text-muted">
            Semua berjalan ringan di browser. Server hanya menyimpan akun, skor, dan cache pembahasan.
          </p>
        </Reveal>
        <Modules />
      </section>
    </>
  );

  function Thresholds() {
    return (
      <div className="flex flex-col gap-3">
        <p className="eyebrow">Ambang batas formasi umum · acuan KepmenPANRB 321/2024</p>
        <div className="grid grid-cols-3 overflow-hidden rounded-none border border-line lg:inline-flex lg:w-auto lg:self-start">
          {Object.entries(PG).map(([code, v], i) => (
            <div
              key={code}
              className={`flex flex-col gap-0.5 py-3.5 pr-7 pl-4 transition-colors duration-200 hover:bg-surface md:pl-5 ${i ? "border-l border-line" : ""}`}
            >
              <span className="text-[12px] font-medium tracking-[0.06em] text-muted">
                <Term tip={TERMS[code]}>{code}</Term>
              </span>
              <span className="font-display text-[32px] tracking-[-0.03em]">
                <CountUp value={v} />
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
}
