import * as Tooltip from "@radix-ui/react-tooltip";
import type { ReactNode, SVGProps } from "react";

/* Logo/Mark — geometri dari Figma (3:18): tiga batang melewati garis ambang. */
export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={className}>
      <rect x="4" y="26" width="56" height="4" fill="var(--accent)" />
      <rect x="10" y="18" width="10" height="40" fill="currentColor" />
      <rect x="27" y="6" width="10" height="52" fill="currentColor" />
      <rect x="44" y="12" width="10" height="46" fill="currentColor" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="group inline-flex items-center gap-2.5 text-fg">
      <LogoMark className="transition-transform duration-300 group-hover:-translate-y-0.5" />
      <span className="font-display text-[24px] font-medium tracking-[-0.04em]">ambang</span>
    </span>
  );
}

type IconProps = SVGProps<SVGSVGElement>;
const stroke = { fill: "none", stroke: "currentColor", "aria-hidden": true } as const;

/* Path ikon diambil persis dari aset Figma; warnanya currentColor agar ikut tema. */
export const Icon = {
  Arrow: (p: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 16 16" strokeWidth="1.5" className="arrow" {...stroke} {...p}>
      <path d="M2 8H13M9 12L13 8L9 4" />
    </svg>
  ),
  ArrowLg: (p: IconProps) => (
    <svg width="20" height="20" viewBox="0 0 20 20" strokeWidth="1.875" className="arrow" {...stroke} {...p}>
      <path d="M2.5 10H16.25M11.25 15L16.25 10L11.25 5" />
    </svg>
  ),
  Back: (p: IconProps) => (
    <svg width="18" height="18" viewBox="0 0 18 18" strokeWidth="1.5" {...stroke} {...p}>
      <path d="M15.5 9H3.5M7.5 4.5L3 9L7.5 13.5" />
    </svg>
  ),
  Moon: (p: IconProps) => (
    <svg width="18" height="18" viewBox="0 0 18 18" strokeWidth="1.125" {...stroke} {...p}>
      <path d="M15 10.125C14.7737 11.1799 14.2671 12.1543 13.5337 12.9455C12.8002 13.7368 11.8669 14.3156 10.8322 14.6211C9.7974 14.9265 8.69941 14.9473 7.65382 14.6812C6.60823 14.4152 5.65373 13.8721 4.89082 13.1092C4.12791 12.3463 3.58484 11.3918 3.31877 10.3462C3.0527 9.30059 3.07349 8.2026 3.37895 7.16784C3.68441 6.13307 4.26323 5.19981 5.05447 4.46633C5.84571 3.73285 6.82009 3.22629 7.875 3C6.93017 3.94483 6.39936 5.2263 6.39936 6.5625C6.39936 7.8987 6.93017 9.18017 7.875 10.125C8.81983 11.0698 10.1013 11.6006 11.4375 11.6006C12.7737 11.6006 14.0552 11.0698 15 10.125Z" />
    </svg>
  ),
  Sun: (p: IconProps) => (
    <svg width="18" height="18" viewBox="0 0 18 18" strokeWidth="1.125" {...stroke} {...p}>
      <circle cx="9" cy="9" r="3.25" />
      <path d="M9 1.5V3.5M9 14.5V16.5M1.5 9H3.5M14.5 9H16.5M3.7 3.7L5.1 5.1M12.9 12.9L14.3 14.3M3.7 14.3L5.1 12.9M12.9 5.1L14.3 3.7" />
    </svg>
  ),
  Menu: (p: IconProps) => (
    <svg width="18" height="18" viewBox="0 0 18 18" strokeWidth="1.125" {...stroke} {...p}>
      <path d="M2.25 5.25H15.75M2.25 9H15.75M2.25 12.75H15.75" />
    </svg>
  ),
  Close: (p: IconProps) => (
    <svg width="18" height="18" viewBox="0 0 18 18" strokeWidth="1.25" {...stroke} {...p}>
      <path d="M4 4L14 14M14 4L4 14" />
    </svg>
  ),
  Sparkle: (p: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 16 16" strokeWidth="1.5" fill="none" stroke="var(--accent)" aria-hidden {...p}>
      <path d="M8 1V5M8 11V15M1 8H5M11 8H15" />
    </svg>
  ),
  Grid: (p: IconProps) => (
    <svg width="18" height="18" viewBox="0 0 18 18" strokeWidth="1.25" {...stroke} {...p}>
      <rect x="2.5" y="2.5" width="5" height="5" />
      <rect x="10.5" y="2.5" width="5" height="5" />
      <rect x="2.5" y="10.5" width="5" height="5" />
      <rect x="10.5" y="10.5" width="5" height="5" />
    </svg>
  ),
  Flag: (p: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 16 16" strokeWidth="1.5" {...stroke} {...p}>
      <rect x="1.75" y="1.75" width="12.5" height="12.5" rx="1.5" stroke="var(--accent)" />
    </svg>
  ),
  Check: (p: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 16 16" strokeWidth="1.75" {...stroke} {...p}>
      <path d="M3 8.5L6.5 12L13 4.5" />
    </svg>
  ),
};

/* Tooltip aksesibel (Radix): muncul saat hover DAN fokus keyboard. Jangan jadikan satu-satunya sumber info (G3). */
export function Tip({ label, children, side = "top" }: { label: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <Tooltip.Root delayDuration={200}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={8}
          className="tooltip z-50 max-w-[300px] rounded-[4px] bg-fg px-3 py-2 text-[12px] leading-snug font-medium text-bg"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/* Istilah dengan penjelasan: teks bergaris putus-putus, bisa difokus keyboard. */
export function Term({ children, tip }: { children: ReactNode; tip: string }) {
  return (
    <Tip label={tip}>
      <span tabIndex={0} className="cursor-help underline decoration-line decoration-dotted underline-offset-4 hover:decoration-fg">
        {children}
      </span>
    </Tip>
  );
}

export const LABELS = ["A", "B", "C", "D", "E"] as const;

export type OptionState = "default" | "selected" | "key" | "wrong" | "muted";

/* Option/Default & Option/Selected dari Figma, plus state review (kunci/salah). */
export function OptionButton({
  label,
  body,
  state,
  score,
  onClick,
  disabled,
}: {
  label: string;
  body: string;
  state: OptionState;
  score?: number;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const box = {
    default: "border-line bg-surface text-fg hover:border-fg hover:translate-x-1",
    selected: "border-accent bg-accent text-on-accent anim-pop",
    key: "border-accent bg-accent text-on-accent",
    wrong: "border-danger bg-surface text-fg line-through decoration-danger/70",
    muted: "border-line bg-surface text-muted",
  }[state];
  const key = state === "selected" || state === "key" ? "bg-on-accent text-accent border-on-accent" : "border-line text-fg";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={state === "selected"}
      className={`group flex w-full items-center gap-4 rounded-[6px] border py-3 pr-5 pl-3.5 text-left transition-all duration-200 disabled:cursor-default ${box}`}
    >
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-[4px] border font-display text-[14px] font-medium no-underline transition-colors ${key}`}>
        {label}
      </span>
      <span className="flex-1 text-[16px]">{body}</span>
      {score !== undefined && (
        <span className="rounded-[4px] border border-current/30 px-2 py-0.5 text-[12px] font-medium no-underline opacity-80">+{score}</span>
      )}
    </button>
  );
}

export function Spinner() {
  return <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />;
}
