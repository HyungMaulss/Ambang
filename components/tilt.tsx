"use client";

import { useRef, type ReactNode } from "react";

/** Elemen miring mengikuti posisi kursor; kembali datar saat kursor keluar. Mati otomatis pada layar sentuh. */
export function Tilt({ children, className = "", max = 10 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = ref.current!.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ref.current!.style.transform = `perspective(700px) rotateX(${-y * max}deg) rotateY(${x * max}deg) scale(1.03)`;
  };
  const reset = () => ref.current && (ref.current.style.transform = "");
  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={reset} className={`transition-transform duration-200 ease-out will-change-transform ${className}`}>
      {children}
    </div>
  );
}
