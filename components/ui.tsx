"use client";

// Small shared building blocks used by the Sprint 4 pages
import Link from "next/link";
import { useEffect, useState } from "react";

export function todayLabel() {
  return new Date()
    .toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
    .toUpperCase()
    .replace(",", " ·");
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Colors for any 0–100 score
export function tone(score: number) {
  if (score >= 80) return { text: "text-green-ink", soft: "bg-green-soft", bar: "bg-green", ring: "#1E7A5C" };
  if (score >= 65) return { text: "text-signal-deep", soft: "bg-signal-soft", bar: "bg-signal", ring: "#2A45D6" };
  if (score >= 50) return { text: "text-amber-ink", soft: "bg-amber-soft", bar: "bg-amber", ring: "#F0A93B" };
  return { text: "text-rust-ink", soft: "bg-rust-soft", bar: "bg-rust", ring: "#A8412F" };
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex max-w-[680px] flex-col gap-1.5">
        <div className="font-mono text-xs tracking-[0.1em] text-muted">{todayLabel()}</div>
        <h1 className="font-display text-[44px] font-bold leading-none tracking-[-0.04em]">{title}</h1>
        {subtitle && <p className="pt-1 text-[17px] leading-normal text-ink-2">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <div className="flex items-center gap-3 font-mono text-sm tracking-[0.08em] text-muted">
        <span className="h-2 w-2 animate-pulse-ring rounded-full bg-signal" />
        {label}
      </div>
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  dark,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  dark?: boolean;
  accent?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-[18px] p-5 ${dark ? "bg-ink text-paper" : "border border-line bg-card"}`}
    >
      <div className={`text-[13px] ${dark ? "text-fog" : "text-muted"}`}>{label}</div>
      <div className={`font-display text-[36px] font-bold leading-none tracking-[-0.04em] [overflow-wrap:anywhere] ${accent ?? ""}`}>{value}</div>
      {hint && <div className={`text-[12px] ${dark ? "text-mist" : "text-muted"}`}>{hint}</div>}
    </div>
  );
}

export function Card({ title, right, children, className = "" }: { title?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`flex animate-fade-in flex-col gap-4 rounded-3xl border border-line bg-card p-6 md:p-7 ${className}`}>
      {(title || right) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {title && <div className="font-mono text-[11px] tracking-[0.1em] text-muted">{title}</div>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ text, href, cta }: { text: string; href?: string; cta?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[18px] border-[1.5px] border-dashed border-line p-10 text-center">
      <p className="max-w-[460px] text-[15px] text-muted">{text}</p>
      {href && cta && (
        <Link href={href} className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper">
          {cta}
        </Link>
      )}
    </div>
  );
}

// Animated score ring
export function ScoreRing({ score, size = 150, label }: { score: number; size?: number; label?: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), 80);
    return () => clearTimeout(t);
  }, [score]);
  const R = 52;
  const C = 2 * Math.PI * R;
  const t = tone(score);
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" className="absolute -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="#ECE7DC" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke={t.ring}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={on ? C * (1 - score / 100) : C}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.2,0.7,0.2,1)" }}
        />
      </svg>
      <div className="flex flex-col items-center">
        <div className="font-display font-bold leading-none tracking-[-0.04em]" style={{ fontSize: size * 0.3 }}>
          {score}
        </div>
        {label && <div className="pt-1 font-mono text-[10px] tracking-[0.12em] text-muted">{label}</div>}
      </div>
    </div>
  );
}

// One labeled progress bar
export function Meter({ label, points, max, note }: { label: string; points: number; max: number; note?: string }) {
  const ratio = max ? points / max : 0;
  const bar = ratio >= 0.8 ? "bg-green" : ratio >= 0.5 ? "bg-amber" : "bg-rust";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="font-mono text-[12px] text-muted">
          {points}/{max}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-paper-2">
        <div className={`h-2 rounded-full transition-[width] duration-1000 ${bar}`} style={{ width: `${ratio * 100}%` }} />
      </div>
      {note && <span className="text-[13px] text-muted">{note}</span>}
    </div>
  );
}

// Simple horizontal bar chart: [{label, value}]
export function BarList({ items, max, suffix = "", color = "bg-signal" }: { items: { label: string; value: number; hint?: string }[]; max?: number; suffix?: string; color?: string }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((i) => (
        <div key={i.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className="truncate">{i.label}</span>
            <span className="shrink-0 font-mono text-[12px] text-muted">
              {i.value}
              {suffix}
              {i.hint ? ` · ${i.hint}` : ""}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-paper-2">
            <div className={`h-2 rounded-full ${color}`} style={{ width: `${(i.value / top) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Simple vertical column chart
export function Columns({ items, height = 140 }: { items: { label: string; value: number }[]; height?: number }) {
  const top = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex items-end gap-2" style={{ height: height + 34 }}>
      {items.map((i) => (
        <div key={i.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <span className="font-mono text-[11px] text-muted">{i.value || ""}</span>
          <div
            className="w-full max-w-[42px] rounded-t-lg bg-signal transition-[height] duration-700"
            style={{ height: Math.max(3, (i.value / top) * height), opacity: i.value ? 1 : 0.25 }}
            title={`${i.label}: ${i.value}`}
          />
          <span className="truncate font-mono text-[10px] text-muted">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

// Small line chart for score trends (values 0–100)
export function Sparkline({ values, width = 260, height = 60 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <div className="text-[13px] text-muted">Run at least two scans to see a trend.</div>;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - (v / 100) * height).toFixed(1)}`).join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="#2A45D6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (
        <circle key={i} cx={i * step} cy={height - (v / 100) * height} r="3" fill="#2A45D6" />
      ))}
    </svg>
  );
}
