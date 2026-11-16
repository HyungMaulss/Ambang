"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui";

const MODULES = [
  {
    title: "Bank soal per kategori",
    desc: "Latihan per subkategori dengan pembahasan langsung setelah menjawab. Soal TKP dinilai berbobot 1–5, bukan benar-salah.",
    tags: ["TWK", "TIU", "TKP", "Psikotes"],
    cta: "Buka bank soal",
    href: "/latihan",
  },
  {
    title: "Tryout bertimer",
    desc: "110 soal dalam 100 menit, navigasi nomor, tandai ragu-ragu. Jawaban tersimpan di perangkat bila koneksi putus.",
    tags: ["30 TWK", "35 TIU", "45 TKP", "100 menit"],
    cta: "Mulai tryout",
    href: "/tryout",
  },
  {
    title: "Pembahasan AI",
    desc: "Tombol “Jelaskan lebih dalam” muncul setelah menjawab. Hasilnya disimpan untuk semua pengguna, jadi soal yang sama tak perlu ditanya ulang.",
    tags: ["Di-cache", "Kuota harian", "Bisa keliru"],
    cta: "Coba di latihan",
    href: "/latihan",
  },
  {
    title: "Excel Lab",
    desc: "Materi rumus bertahap dan grid praktik di browser. Aktifkan “Nilai pekerjaan saya” bila ingin dicek; pemisah , dan ; sama-sama diterima.",
    tags: ["IF", "XLOOKUP", "SUMIFS", "TEXT"],
    cta: "Buka Excel Lab",
    href: "/excel",
  },
];

export function Modules() {
  const [open, setOpen] = useState(0);
  return (
    <div className="flex flex-col">
      {MODULES.map((m, i) => {
        const isOpen = open === i;
        const n = String(i + 1).padStart(2, "0");
        return (
          <div
            key={m.title}
            className={`rounded-none transition-colors duration-300 ${isOpen ? "inverse" : "rounded-none border-b border-line hover:bg-surface"}`}
          >
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? -1 : i)}
              className="group flex w-full items-center gap-4 px-2 py-[22px] text-left md:gap-8 md:px-9 md:py-7"
            >
              <span className={`font-display text-[15px] font-medium md:text-[16px] ${isOpen ? "text-accent" : "text-muted"}`}>{n}</span>
              <span className="flex-1 font-display text-[22px] tracking-[-0.02em] md:text-[32px]">{m.title}</span>
              <span className={`transition-transform duration-300 ${isOpen ? "rotate-90 text-accent" : "group-hover:translate-x-1"}`}>
                <Icon.ArrowLg />
              </span>
            </button>
            <div className="expand" data-open={isOpen}>
              <div>
                <div className="flex flex-col gap-4 px-5 pb-6 md:flex-row md:items-start md:gap-8 md:pr-9 md:pb-9 md:pl-[86px]">
                  <div className="flex flex-1 flex-col gap-4">
                    <p className="max-w-[560px] text-[16px] leading-[1.55] text-muted">{m.desc}</p>
                    <div className="flex flex-wrap gap-2">
                      {m.tags.map((t) => (
                        <span key={t} className="tag">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Link href={m.href} className="btn btn-accent justify-between py-3 text-[14px] md:justify-center" tabIndex={isOpen ? 0 : -1}>
                    {m.cta} <Icon.ArrowLg />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
