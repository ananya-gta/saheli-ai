import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";

type Variant = "primary" | "secondary" | "ghost" | "whatsapp";
const styles: Record<Variant, string> = {
  primary: "bg-plum-700 text-ivory hover:bg-plum-800 shadow-lift",
  secondary: "bg-white text-ink border border-line hover:border-plum-600/40 hover:bg-plum-50",
  ghost: "text-plum-700 hover:bg-plum-50",
  whatsapp: "bg-[#1E9E57] text-white hover:bg-[#188A4B]",
};

export function Button({ variant = "primary", icon, loading, className = "", children, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: string; loading?: boolean }) {
  return (
    <button {...rest} disabled={rest.disabled || loading}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold transition
        active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}>
      {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" /> : icon ? <Icon name={icon} className="size-[18px]" /> : null}
      {children}
    </button>
  );
}

export function Card({ children, className = "", tone = "default" }: { children: ReactNode; className?: string; tone?: "default" | "accent" | "success" }) {
  const t = tone === "accent" ? "border-saffron/40 bg-white" : tone === "success" ? "border-leaf/30 bg-white" : "border-line bg-white";
  return <div className={`animate-rise rounded-2xl border ${t} p-4 shadow-card sm:p-5 ${className}`}>{children}</div>;
}

export function Eyebrow({ children, tone = "plum" }: { children: ReactNode; tone?: "plum" | "saffron" | "leaf" }) {
  const c = tone === "saffron" ? "text-[#9A6420]" : tone === "leaf" ? "text-leaf" : "text-rose";
  return <p className={`mb-1 text-[11.5px] font-bold uppercase tracking-[.14em] ${c}`}>{children}</p>;
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "leaf" | "saffron" | "plum" }) {
  const c = { neutral: "bg-cream text-muted", leaf: "bg-leaf-50 text-leaf", saffron: "bg-saffron-50 text-[#9A6420]", plum: "bg-plum-50 text-plum-700" }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${c}`}>{children}</span>;
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "error" }) {
  const c = tone === "error" ? "border-rose/30 bg-[#FCEFF1] text-[#8E2E43]" : tone === "warn" ? "border-saffron/40 bg-saffron-50 text-[#7A4E14]" : "border-line bg-cream text-muted";
  return <div className={`rounded-xl border px-3 py-2 text-[13.5px] leading-snug ${c}`}>{children}</div>;
}

/** Circular score (0-100) — used for launch readiness. */
export function ScoreRing({ value, size = 96, stroke = 3.2 }: { value: number; size?: number; stroke?: number }) {
  const c = 2 * Math.PI * 15.5;
  const color = value >= 80 ? "#2F7D5B" : value >= 55 ? "#D9963A" : "#B4475F";
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={`Score ${value} out of 100`}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" width={size} height={size}>
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="#E9DDCF" strokeWidth={stroke} />
        <circle cx="18" cy="18" r="15.5" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} style={{ transition: "stroke-dashoffset 1s cubic-bezier(.2,.7,.2,1)" }} />
      </svg>
      <span className="font-display leading-none" style={{ fontSize: size * 0.32 }}>{value}</span>
    </span>
  );
}
