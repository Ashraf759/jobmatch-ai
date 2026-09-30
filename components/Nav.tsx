"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Active = "dashboard" | "tracker";

function DashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="2" />
      <rect x="14" y="3" width="7" height="5" rx="2" />
      <rect x="14" y="12" width="7" height="9" rx="2" />
      <rect x="3" y="16" width="7" height="5" rx="2" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}

function MatchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="12" r="5" />
      <circle cx="15" cy="12" r="5" />
    </svg>
  );
}

function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="32" height="32" rx="10" fill="#F5F2EB" />
      <circle cx="13.5" cy="17" r="6" stroke="#14161B" strokeWidth="2.2" />
      <circle cx="20.5" cy="17" r="6" stroke="#2A45D6" strokeWidth="2.2" />
    </svg>
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
    `flex items-center gap-3 rounded-xl p-3 transition ${
      on ? "bg-ink-raised font-semibold text-white" : "text-fog hover:bg-ink-soft hover:text-white"
    }`;

  return (
    <>
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-8 bg-ink px-5 py-7 text-paper lg:flex">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-2 text-paper">
          <LogoMark />
          <span className="font-display text-xl font-bold tracking-[-0.02em]">JobMatch</span>
        </Link>

        <nav aria-label="App" className="flex flex-col gap-1 text-[15px]">
          <Link href="/dashboard" aria-current={active === "dashboard" ? "page" : undefined} className={linkClass(active === "dashboard")}>
            <DashIcon />
            Dashboard
          </Link>
          <Link href="/tracker" aria-current={active === "tracker" ? "page" : undefined} className={linkClass(active === "tracker")}>
            <ListIcon />
            Applications
          </Link>
          <span aria-disabled="true" className="flex items-center gap-3 rounded-xl p-3 text-mist">
            <DocIcon />
            Résumés
            <span className="ml-auto font-mono text-[10px]">SOON</span>
          </span>
          <span aria-disabled="true" className="flex items-center gap-3 rounded-xl p-3 text-mist">
            <MatchIcon />
            AI Match
            <span className="ml-auto font-mono text-[10px]">SOON</span>
          </span>
        </nav>

        <div className="mt-auto flex flex-col gap-3 rounded-2xl bg-ink-soft p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-signal text-sm font-bold text-white">
              {initial}
            </div>
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
      <div className="flex items-center justify-between gap-4 bg-ink px-5 py-4 text-paper lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2 text-paper">
          <LogoMark size={26} />
          <span className="font-display text-lg font-bold tracking-[-0.02em]">JobMatch</span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className={active === "dashboard" ? "font-semibold text-white" : "text-fog"}>
            Dashboard
          </Link>
          <Link href="/tracker" className={active === "tracker" ? "font-semibold text-white" : "text-fog"}>
            Applications
          </Link>
          <button type="button" onClick={handleSignOut} className="cursor-pointer text-fog">
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}