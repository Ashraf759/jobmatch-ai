"use client";

// Notification bell, live notice data, and pop-up toasts
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  buildNotices,
  hideNotice,
  localDay,
  refreshNotices,
  type Notice,
  type NoticeApp,
  type NoticeGroup,
  type NoticeResume,
} from "@/utils/notifications";

export const GROUP_STYLE: Record<NoticeGroup, { label: string; dot: string; chip: string; border: string }> = {
  overdue: { label: "OVERDUE", dot: "bg-rust", chip: "bg-rust-soft text-rust-ink", border: "border-l-rust" },
  today: { label: "TODAY", dot: "bg-amber", chip: "bg-amber-soft text-amber-ink", border: "border-l-amber" },
  upcoming: { label: "UPCOMING", dot: "bg-signal", chip: "bg-signal-soft text-signal-deep", border: "border-l-signal" },
  suggestion: { label: "SUGGESTIONS", dot: "bg-slate", chip: "bg-paper-2 text-ink-2", border: "border-l-slate" },
};

// Loads applications + résumés and keeps the notice list up to date
export function useNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const supabase = createClient();

  async function load() {
    const [{ data: apps }, { data: resumes }] = await Promise.all([
      supabase.from("applications").select("id, company, role, status, date_applied, follow_up_date"),
      supabase.from("resumes").select("id, label, file_name, health_score"),
    ]);
    setNotices(buildNotices((apps ?? []) as NoticeApp[], (resumes ?? []) as NoticeResume[]));
  }

  useEffect(() => {
    load();
    const onRefresh = () => load();
    window.addEventListener("jm:refresh", onRefresh);
    window.addEventListener("focus", onRefresh);
    const timer = setInterval(load, 60_000);
    return () => {
      window.removeEventListener("jm:refresh", onRefresh);
      window.removeEventListener("focus", onRefresh);
      clearInterval(timer);
    };
  }, []);

  // Done: follow-ups are cleared, suggestions are dismissed
  async function done(n: Notice) {
    if (n.kind === "followup" && n.appId) await supabase.from("applications").update({ follow_up_date: null }).eq("id", n.appId);
    else hideNotice(n.id, "forever");
    refreshNotices();
  }

  // Snooze: move the reminder (or hide the suggestion) until tomorrow
  async function snooze(n: Notice) {
    if (n.kind === "followup" && n.appId) await supabase.from("applications").update({ follow_up_date: localDay(1) }).eq("id", n.appId);
    else hideNotice(n.id, localDay(1));
    refreshNotices();
  }

  return { notices, done, snooze };
}

export function NoticeItem({ n, onDone, onSnooze, onOpen }: { n: Notice; onDone: () => void; onSnooze: () => void; onOpen?: () => void }) {
  const s = GROUP_STYLE[n.group];
  return (
    <div className={`flex flex-col gap-2 rounded-xl border-l-4 bg-paper px-3 py-2.5 ${s.border}`}>
      <div className="flex flex-col gap-0.5">
        <span className="text-[14px] font-semibold leading-snug text-ink">{n.title}</span>
        <span className="text-[12px] text-muted">{n.detail}</span>
      </div>
      <div className="flex gap-1.5">
        <Link href={n.href} onClick={onOpen} className="rounded-full bg-ink px-3 py-1 text-[12px] font-semibold text-paper">
          Open
        </Link>
        <button type="button" onClick={onDone} className="cursor-pointer rounded-full border border-line px-3 py-1 text-[12px] font-medium text-ink hover:border-ink">
          Done
        </button>
        <button type="button" onClick={onSnooze} className="cursor-pointer rounded-full px-3 py-1 text-[12px] text-muted hover:bg-paper-2">
          Snooze 1 day
        </button>
      </div>
    </div>
  );
}

export function NotificationBell({ align = "left" }: { align?: "left" | "right" }) {
  const { notices, done, snooze } = useNotices();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const urgent = notices.filter((n) => n.group === "overdue" || n.group === "today").length;
  const overdue = notices.some((n) => n.group === "overdue");
  const groups: NoticeGroup[] = ["overdue", "today", "upcoming", "suggestion"];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={`Notifications: ${urgent} need action today, ${notices.length} in total`}
        className={`relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl transition ${
          urgent ? "bg-rust text-white" : "text-fog hover:bg-ink-soft hover:text-white"
        }`}
      >
        {overdue && <span className="absolute inset-0 animate-ping rounded-xl bg-rust opacity-40" />}
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="relative">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {notices.length > 0 && (
          <span
            className={`absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-mono text-[11px] font-bold ${
              urgent ? "bg-white text-rust-ink" : "bg-signal text-white"
            }`}
          >
            {urgent || notices.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute top-12 z-50 flex max-h-[75vh] w-[370px] max-w-[92vw] flex-col gap-3 overflow-y-auto rounded-2xl border border-line bg-card p-4 text-ink shadow-[0_30px_60px_-28px_rgba(0,0,0,0.55)] ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-display text-lg font-bold">Notifications</span>
            <span className="font-mono text-[11px] text-muted">{notices.length} TOTAL</span>
          </div>
          {notices.length === 0 && <p className="py-4 text-center text-[14px] text-muted">You’re all caught up. Nothing needs attention.</p>}
          {groups.map((g) => {
            const list = notices.filter((n) => n.group === g);
            if (!list.length) return null;
            const s = GROUP_STYLE[g];
            return (
              <div key={g} className="flex flex-col gap-2">
                <div className="flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.1em] text-muted">
                  <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                  {s.label} · {list.length}
                </div>
                {list.map((n) => (
                  <NoticeItem key={n.id} n={n} onDone={() => done(n)} onSnooze={() => snooze(n)} onOpen={() => setOpen(false)} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Pop-up messages in the bottom-right corner
export function ToastHost() {
  const [items, setItems] = useState<{ id: number; message: string; href?: string }[]>([]);
  useEffect(() => {
    function show(message: string, href?: string) {
      try {
        sessionStorage.removeItem("jm-toast");
      } catch {
        // ignore
      }
      const id = Date.now() + Math.random();
      setItems((list) => [...list, { id, message, href }]);
      setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 6000);
    }
    // A toast sent just before a page change
    try {
      const saved = JSON.parse(sessionStorage.getItem("jm-toast") || "null");
      if (saved && Date.now() - saved.at < 10_000) show(saved.message, saved.href);
    } catch {
      // ignore
    }
    function onToast(e: Event) {
      const { message, href } = (e as CustomEvent).detail ?? {};
      show(message, href);
    }
    window.addEventListener("jm:toast", onToast);
    return () => window.removeEventListener("jm:toast", onToast);
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col gap-2" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="pointer-events-auto flex animate-fade-up items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-[14px] text-paper shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)]">
          <span className="h-2 w-2 rounded-full bg-mint" />
          <span>{t.message}</span>
          {t.href && (
            <Link href={t.href} className="font-semibold text-signal-glow">
              View →
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
