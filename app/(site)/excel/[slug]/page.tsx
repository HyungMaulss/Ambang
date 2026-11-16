import Link from "next/link";
import { notFound } from "next/navigation";
import { ExcelLab } from "@/components/excel-lab";
import { Icon } from "@/components/ui";
import { LESSONS } from "@/lib/excel-lessons";

export const generateStaticParams = () => LESSONS.map((l) => ({ slug: l.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const l = LESSONS.find((x) => x.slug === slug);
  return { title: l ? `${l.title} · Excel Lab` : "Excel Lab" };
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const i = LESSONS.findIndex((x) => x.slug === slug);
  if (i < 0) notFound();
  const l = LESSONS[i];
  const next = LESSONS[i + 1];

  return (
    <div className="mx-auto grid max-w-[1440px] gap-10 px-5 pt-6 pb-20 md:px-10 md:pt-10 lg:grid-cols-[380px_1fr] xl:px-20">
      <aside className="anim-fade-up flex flex-col gap-6 lg:sticky lg:top-8 lg:self-start">
        <Link href="/excel" className="group inline-flex items-center gap-2 text-[14px] text-muted transition-colors hover:text-fg">
          <span className="transition-transform group-hover:-translate-x-1">
            <Icon.Back />
          </span>
          Semua topik
        </Link>
        <div>
          <p className="eyebrow">
            Topik {String(i + 1).padStart(2, "0")} · {l.topic}
          </p>
          <h1 className="mt-3 font-display text-[34px] leading-[1.1] tracking-[-0.03em] md:text-[44px]">{l.title}</h1>
        </div>
        {l.body.map((p) => (
          <p key={p} className="text-[16px] leading-[1.6] text-muted">
            {p}
          </p>
        ))}
        <div className="flex flex-col gap-2">
          <p className="eyebrow">Contoh</p>
          {l.examples.map((e) => (
            <div key={e.f} className="card lift group flex flex-col gap-1 p-3">
              <code className="font-mono text-[13px] break-all">{e.f}</code>
              <span className="text-[13px] text-muted">{e.note}</span>
            </div>
          ))}
        </div>
      </aside>

      <section className="anim-fade-up flex min-w-0 flex-col gap-8" style={{ animationDelay: "100ms" }}>
        <div className="flex flex-col gap-2">
          <p className="eyebrow">Praktik</p>
          <ExcelLab key={l.exercise.id} ex={l.exercise} />
        </div>
        {next && (
          <Link href={`/excel/${next.slug}`} className="btn btn-secondary self-start">
            Lanjut: {next.title} <Icon.Arrow />
          </Link>
        )}
      </section>
    </div>
  );
}
