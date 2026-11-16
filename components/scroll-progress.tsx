"use client";

import { useEffect, useRef } from "react";

/** Garis aksen tipis di atas halaman yang memanjang sesuai posisi gulir. */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      ref.current?.style.setProperty("--p", String(max > 0 ? scrollY / max : 0));
    };
    on();
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on);
    return () => (removeEventListener("scroll", on), removeEventListener("resize", on));
  }, []);
  return <div ref={ref} aria-hidden className="scroll-bar fixed inset-x-0 top-0 z-50 h-[3px] bg-accent" />;
}
