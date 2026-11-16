"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { supabase, useRole, useUser } from "@/lib/supabase";
import { Icon, Logo, Tip } from "./ui";

export const NAV = [
  { href: "/", label: "Beranda" },
  { href: "/latihan", label: "Latihan" },
  { href: "/tryout", label: "Tryout" },
  { href: "/excel", label: "Excel Lab" },
  { href: "/statistik", label: "Statistik" },
];

export function ThemeToggle({ size = 48 }: { size?: number }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  const label = dark ? "Ganti ke tema terang" : "Ganti ke tema gelap";
  return (
    <Tip label={label} side="bottom">
      <button
        type="button"
        aria-label={label}
        onClick={() => setTheme(dark ? "light" : "dark")}
        className="icon-btn group"
        style={{ width: size, height: size }}
      >
        <span className="transition-transform duration-500 group-hover:rotate-[-25deg]">{dark ? <Icon.Sun /> : <Icon.Moon />}</span>
      </button>
    </Tip>
  );
}

function AuthButton() {
  const user = useUser();
  if (!supabase) return null; // mode demo: tidak ada login
  if (user === undefined) return <span className="h-[46px] w-[88px]" />;
  if (!user)
    return (
      <Link href="/masuk" className="btn btn-primary">
        Masuk
      </Link>
    );
  return (
    <Tip label={`Masuk sebagai ${user.email}. Klik untuk keluar.`} side="bottom">
      <button type="button" className="btn btn-secondary" onClick={() => supabase!.auth.signOut()}>
        Keluar
      </button>
    </Tip>
  );
}

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

export function Header() {
  const path = usePathname();
  const menu = useRef<HTMLDialogElement>(null);
  useEffect(() => menu.current?.close(), [path]);
  const role = useRole(useUser());
  const links = role === "superadmin" ? [...NAV, { href: "/admin", label: "Admin" }] : NAV;

  return (
    <header className="relative z-20 mx-auto flex w-full max-w-[1440px] items-center justify-between px-5 py-4 md:px-10 md:py-7 xl:px-20">
      <Link href="/" aria-label="Ambang — beranda">
        <Logo />
      </Link>

      <nav aria-label="Utama" className="hidden gap-0.5 rounded-none border border-line bg-surface p-[5px] lg:flex">
        {links.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={isActive(path, n.href) ? "page" : undefined}
            className={`rounded-none px-4 py-[9px] text-[14px] font-medium transition-colors duration-200 ${
              isActive(path, n.href) ? "bg-fg text-bg" : "text-muted hover:bg-bg hover:text-fg"
            }`}
          >
            {n.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-2 md:gap-2.5">
        <div className="hidden lg:contents">
          <ThemeToggle />
          <AuthButton />
        </div>
        <div className="flex gap-2 lg:hidden">
          <ThemeToggle size={44} />
          <button type="button" aria-label="Buka menu" className="icon-btn" onClick={() => menu.current?.showModal()}>
            <Icon.Menu />
          </button>
        </div>
      </div>

      <dialog
        ref={menu}
        aria-label="Menu"
        className="m-0 ml-auto h-dvh max-h-none w-[min(320px,85vw)] border-l border-line bg-bg p-5 text-fg"
        onClick={(e) => e.target === menu.current && menu.current?.close()}
      >
        <div className="flex items-center justify-between">
          <Logo />
          <button type="button" aria-label="Tutup menu" className="icon-btn" onClick={() => menu.current?.close()}>
            <Icon.Close />
          </button>
        </div>
        <nav aria-label="Utama (mobile)" className="mt-8 flex flex-col">
          {[...links, { href: "/unggah", label: "Unggah soal" }].map((n, i) => (
            <Link
              key={n.href}
              href={n.href}
              style={{ animationDelay: `${i * 40}ms` }}
              className={`anim-fade-up flex items-center justify-between border-b border-line py-4 font-display text-[22px] transition-colors hover:text-accent ${
                isActive(path, n.href) ? "text-fg" : "text-muted"
              }`}
            >
              {n.label}
              <Icon.ArrowLg />
            </Link>
          ))}
        </nav>
        <div className="mt-8">
          <AuthButton />
        </div>
      </dialog>
    </header>
  );
}
