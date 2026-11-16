"use client";

import { useEffect, useRef, useState } from "react";

/** Angka yang berjalan dari 0 ke nilai akhir saat pertama terlihat. Pembaca layar langsung menerima nilai akhir. */
export function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return setShown(value);
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        setShown(Math.round(value * (1 - (1 - p) ** 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    if (ref.current) io.observe(ref.current);
    return () => (io.disconnect(), cancelAnimationFrame(raf));
  }, [value, duration]);
  return (
    <span ref={ref} aria-label={String(value)} className="tabular-nums">
      <span aria-hidden>{shown}</span>
    </span>
  );
}
