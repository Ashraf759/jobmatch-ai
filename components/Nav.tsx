"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Active =
  | "dashboard"
  | "tracker"
  | "resumes"
  | "jobs"
  | "match"
  | "ats"
  | "tailor"
  | "letters"
  | "insights";

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const ICONS: Record<Active, string> = {
  dashboard: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  tracker: "M4 6h16M4 12h16M4 18h10",
  resumes: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4",
  jobs: "M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18",
  match: "M9 7a5 5 0 1 0 0 10A5 5 0 0 0 9 7zM15 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z",
  ats: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2M14 18h6M18 14h2",
  tailor: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  letters: "M4 5h16v14H4zM4 7l8 6 8-6",
  insights: "M4 20V10M10 20V4M16 20v-7M22 20H2",
};

const GROUPS: { title: string; items: { key: Active; href: string; label: string; short: string }[] }[] = [
  {
    title: "TRACK",
    items: [
      { key: "dashboard", href: "/dashboard", label: "Dashboard", short: "Dashboard" },
      { key: "tracker", href: "/tracker", label: "Applications", short: "Applications" },
      { key: "jobs", href: "/jobs", label: "Job postings", short: "Jobs" },
    ],
  },
  {
    title: "RÉSUMÉ TOOLS",
    items: [
      { key: "resumes", href: "/resumes", label: "Résumés", short: "Résumés" },
      { key: "match", href: "/match", label: "AI Match", short: "AI Match" },
      { key: "ats", href: "/ats", label: "ATS Scanner", short: "ATS" },
      { key: "tailor", href: "/tailor", label: "Tailoring Studio", short: "Tailoring" },
      { key: "letters", href: "/cover-letters", label: "Cover Letters", short: "Letters" },
    ],
  },
  {
    title: "ANALYZE",
    items: [{ key: "insights", href: "/insights", label: "Insights", short: "Insights" }],
  },
];

function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="32" height="32" rx="10" fill="#F5F2EB" />
      <circle cx="13.5" cy="17" r="6" stroke="#14161B" strokeWidth="2.2" />
      <circle cx="20.5" cy="17" r="6" stroke="#2A45D6" strokeWidth="2.2" />
    </svg>
  );
}

type Due = { id: string; company: string; role: string; follow_up_date: string };

// Notification bell (SCRUM-36): follow-ups that are due today or overdue
function Bell() {
  const [items, setItems] = useState<Due[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const { data } = await supabase
        .from("applications")
        .select("id, company, role, follow_up_date, status")
        .not("follow_up_date", "is", null)
        .lte("follow_up_date", today)
        .in("status", ["saved", "applied", "interview"])
        .order("follow_up_date", { ascending: true });
      setItems((data ?? []) as Due[]);
    }
    load();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={`Notifications: ${items.length} follow-ups due`}
        className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] text-fog transition hover:bg-ink-soft hover:text-white"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {items.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rust px-1 font-mono text-[10px] font-bold text-white">
            {items.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 flex w-[290px] flex-col gap-1 rounded-2xl border border-line bg-card p-3 text-ink shadow-[0_24px_50px_-24px_rgba(0,0,0,0.5)] lg:left-0 lg:right-auto">
          <div className="px-2 pb-1 font-mono text-[11px] tracking-[0.1em] text-muted">FOLLOW-UPS DUE</div>
          {items.length === 0 && <p className="px-2 py-2 text-[13px] text-muted">You’re all caught up.</p>}
          {items.slice(0, 6).map((a) => (
            <Link key={a.id} href={`/tracker?app=${a.id}`} onClick={() => setOpen(false)} className="flex flex-col rounded-xl px-2 py-2 hover:bg-paper">
              <span className="truncate text-[14px] font-semibold">Follow up: {a.role}</span>
              <span className="truncate text-[12px] text-muted">
                {a.company} · due {new Date(`${a.follow_up_date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </Link>
          ))}
          <Link href="/dashboard" onClick={() => setOpen(false)} className="px-2 pt-1 text-[13px] font-semibold text-signal">
            See all on the dashboard →
          </Link>
        </div>
      )}
    </div>
  );
}

export default function Nav({ email, active }: { email?: string; active?: Active }) {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const name = email ? email.split("@")[0] : "Signed in";
  const initial = (email?.[0] ?? "?").toUpperCase();

  const linkClass = (on: boolean) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
      on ? "bg-ink-raised font-semibold text-white" : "text-fog hover:bg-ink-soft hover:text-white"
    }`;

  return (
    <>
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-6 bg-ink px-5 py-7 text-paper lg:flex">
        <div className="flex items-center justify-between gap-2">
          <Link href="/dashboard" className="flex items-center gap-2.5 px-2 text-paper">
            <LogoMark />
            <span className="font-display text-xl font-bold tracking-[-0.02em]">JobMatch</span>
          </Link>
          <Bell />
        </div>

        <nav aria-label="App" className="flex flex-col gap-4 text-[15px]">
          {GROUPS.map((g) => (
            <div key={g.title} className="flex flex-col gap-0.5">
              <div className="px-3 pb-1 font-mono text-[10px] tracking-[0.14em] text-mist">{g.title}</div>
              {g.items.map((it) => (
                <Link key={it.key} href={it.href} aria-current={active === it.key ? "page" : undefined} className={linkClass(active === it.key)}>
                  <Icon d={ICONS[it.key]} />
                  {it.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3 rounded-2xl bg-ink-soft p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-signal text-sm font-bold text-white">{initial}</div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="truncate text-sm font-semibold">{name}</div>
              <div className="truncate text-xs text-mist">{email ?? ""}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="cursor-pointer rounded-[10px] border border-ink-border px-3 py-2.5 text-[13px] text-fog transition hover:bg-ink-raised hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ---------- Mobile top bar ---------- */}
      <div className="flex flex-col gap-3 bg-ink px-5 py-4 text-paper lg:hidden">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-paper">
            <LogoMark size={26} />
            <span className="font-display text-lg font-bold tracking-[-0.02em]">JobMatch</span>
          </Link>
          <div className="flex items-center gap-2">
            <Bell />
            <button type="button" onClick={handleSignOut} className="cursor-pointer text-sm text-fog">
              Sign out
            </button>
          </div>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-1 text-sm">
          {GROUPS.flatMap((g) => g.items).map((it) => (
            <Link key={it.key} href={it.href} className={`shrink-0 ${active === it.key ? "font-semibold text-white" : "text-fog"}`}>
              {it.short}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
