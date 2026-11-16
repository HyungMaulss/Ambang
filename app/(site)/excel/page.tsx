import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { Icon } from "@/components/ui";
import { LESSONS } from "@/lib/excel-lessons";

export const metadata = { title: "Excel Lab" };

export default function ExcelIndex() {
  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-5 pt-6 pb-20 md:px-10 md:pt-10 xl:px-20">
      <div className="anim-fade-up flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Excel Lab</p>
          <h1 className="mt-3 font-display text-[40px] leading-[1.05] tracking-[-0.03em] md:text-[56px]">
            Rumus kerja,
            <br />
            dari dasar.
          </h1>
        </div>
        <p className="max-w-[420px] text-[16px] leading-[1.55] text-muted">
          Tiap topik berisi materi singkat dan satu grid praktik yang berjalan di browser. Penilaian bersifat opsional.
        </p>
      </div>
      <div className="flex flex-col">
        {LESSONS.map((l, i) => (
          <Reveal key={l.slug} delay={i * 60}>
            <Link
              href={`/excel/${l.slug}`}
              className="group flex items-center gap-4 border-b border-line px-2 py-6 transition-colors duration-200 hover:bg-surface md:gap-8 md:px-9"
            >
              <span className="font-display text-[15px] font-medium text-muted transition-colors group-hover:text-accent-ink">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex flex-1 flex-col gap-1">
                <span className="font-display text-[22px] tracking-[-0.02em] md:text-[30px]">{l.title}</span>
                <span className="text-[14px] text-muted">{l.summary}</span>
              </span>
              <span className="hidden gap-2 md:flex">
                {l.exercise.required.map((f) => (
                  <span key={f} className="tag font-mono text-[12px]">
                    {f}
                  </span>
                ))}
              </span>
              <span className="transition-transform duration-300 group-hover:translate-x-1.5">
                <Icon.ArrowLg />
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
