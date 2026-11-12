// Notifications: one place that decides what needs the user's attention.
// Used by the bell, the dashboard banner and the Applications list.

export type NoticeGroup = "overdue" | "today" | "upcoming" | "suggestion";
export type Notice = {
  id: string;
  group: NoticeGroup;
  kind: "followup" | "noreply" | "saved" | "health";
  title: string;
  detail: string;
  href: string;
  appId?: string;
};

export type NoticeApp = {
  id: string;
  company: string;
  role: string;
  status: string;
  date_applied: string | null;
  follow_up_date: string | null;
};
export type NoticeResume = { id: string; label: string | null; file_name: string; health_score: number | null };

const NO_REPLY_DAYS = 14;
const SAVED_DAYS = 7;
const UPCOMING_DAYS = 3;
const LOW_HEALTH = 55;
const STORE_KEY = "jm-notice-hidden";

// Local calendar date as YYYY-MM-DD (not UTC)
export function localDay(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Whole days from a to b (b - a)
export function daysBetween(a: string, b: string) {
  const ms = new Date(`${b.slice(0, 10)}T00:00:00`).getTime() - new Date(`${a.slice(0, 10)}T00:00:00`).getTime();
  return Math.round(ms / 864e5);
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

// Hidden suggestions: id -> date it can come back ("forever" = dismissed)
function readHidden(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function hideNotice(id: string, until: string | "forever") {
  try {
    const all = readHidden();
    all[id] = until;
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch {
    // storage unavailable: it will just show again
  }
}

export function buildNotices(apps: NoticeApp[], resumes: NoticeResume[]): Notice[] {
  const today = localDay();
  const hidden = readHidden();
  const isHidden = (id: string) => hidden[id] === "forever" || (hidden[id] && hidden[id] > today);
  const out: Notice[] = [];

  for (const a of apps) {
    const active = !["offer", "rejected"].includes(a.status);
    const who = `${a.company}`;

    // Follow-up reminders
    if (a.follow_up_date && active) {
      const diff = daysBetween(today, a.follow_up_date); // negative = overdue
      if (diff < 0)
        out.push({
          id: `followup:${a.id}`,
          group: "overdue",
          kind: "followup",
          title: `Overdue by ${plural(-diff, "day")}: follow up with ${who}`,
          detail: a.role,
          href: `/tracker?app=${a.id}`,
          appId: a.id,
        });
      else if (diff === 0)
        out.push({
          id: `followup:${a.id}`,
          group: "today",
          kind: "followup",
          title: `Today: follow up with ${who}`,
          detail: a.role,
          href: `/tracker?app=${a.id}`,
          appId: a.id,
        });
      else if (diff <= UPCOMING_DAYS)
        out.push({
          id: `followup:${a.id}`,
          group: "upcoming",
          kind: "followup",
          title: `In ${plural(diff, "day")}: follow up with ${who}`,
          detail: a.role,
          href: `/tracker?app=${a.id}`,
          appId: a.id,
        });
    }

    // No reply after applying
    if (a.status === "applied" && a.date_applied && !a.follow_up_date) {
      const age = daysBetween(a.date_applied, today);
      const id = `noreply:${a.id}`;
      if (age >= NO_REPLY_DAYS && !isHidden(id))
        out.push({
          id,
          group: "suggestion",
          kind: "noreply",
          title: `No reply from ${who} in ${age} days`,
          detail: `${a.role} · follow up or mark it Rejected`,
          href: `/tracker?app=${a.id}`,
          appId: a.id,
        });
    }

    // Saved but never applied
    if (a.status === "saved" && a.date_applied) {
      const age = daysBetween(a.date_applied, today);
      const id = `saved:${a.id}`;
      if (age >= SAVED_DAYS && !isHidden(id))
        out.push({
          id,
          group: "suggestion",
          kind: "saved",
          title: `Saved ${age} days ago, not applied yet`,
          detail: `${a.role} at ${who} · apply or remove it`,
          href: `/tracker?app=${a.id}`,
          appId: a.id,
        });
    }
  }

  // Résumés that need work
  for (const r of resumes) {
    const id = `health:${r.id}`;
    if (r.health_score !== null && r.health_score < LOW_HEALTH && !isHidden(id))
      out.push({
        id,
        group: "suggestion",
        kind: "health",
        title: `${r.label || r.file_name} scored ${r.health_score}/100`,
        detail: "Open the Health Report to see what to fix",
        href: `/resumes/${r.id}`,
      });
  }

  const order: Record<NoticeGroup, number> = { overdue: 0, today: 1, upcoming: 2, suggestion: 3 };
  return out.sort((a, b) => order[a.group] - order[b.group]);
}

// ---------- Live updates ----------
// Any page that changes data calls refreshNotices(); the bell and banner listen for it.
export function refreshNotices() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("jm:refresh"));
}

// Small pop-up message in the corner
// Shows now, or (afterNav = true) right after the next page change
export function toast(message: string, href?: string, afterNav = false) {
  if (typeof window === "undefined") return;
  if (afterNav) {
    try {
      sessionStorage.setItem("jm-toast", JSON.stringify({ message, href, at: Date.now() }));
    } catch {
      // storage unavailable: skip the message
    }
    return;
  }
  window.dispatchEvent(new CustomEvent("jm:toast", { detail: { message, href } }));
}
