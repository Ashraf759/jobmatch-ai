"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Nav from "@/components/Nav";

type Application = {
  id: string;
  company: string;
  role: string;
  status: string;
  date_applied: string;
};

type StatusInfo = { value: string; label: string; dot: string; chip: string; hex: string };

const STATUSES: StatusInfo[] = [
  { value: "applied", label: "Applied", dot: "bg-signal", chip: "bg-signal-soft text-signal-deep", hex: "#2A45D6" },
  { value: "interview", label: "Interview", dot: "bg-amber", chip: "bg-amber-soft text-amber-ink", hex: "#F0A93B" },
  { value: "offer", label: "Offer", dot: "bg-green", chip: "bg-green-soft text-green-ink", hex: "#1E7A5C" },
  { value: "rejected", label: "Rejected", dot: "bg-rust", chip: "bg-rust-soft text-rust-ink", hex: "#A8412F" },
];

function statusInfo(value: string): StatusInfo {
  return (
    STATUSES.find((s) => s.value === value) ?? {
      value,
      label: value,
      dot: "bg-slate",
      chip: "bg-slate-soft text-slate-ink",
      hex: "#6B6F7A",
    }
  );
}

function nextStatus(value: string) {
  const i = STATUSES.findIndex((s) => s.value === value);
  return STATUSES[(i + 1) % STATUSES.length].value;
}

const LOGOS = [
  "bg-signal-soft text-signal-deep",
  "bg-amber-soft text-amber-ink",
  "bg-green-soft text-green-ink",
  "bg-ink text-paper",
  "bg-rust-soft text-rust-ink",
  "bg-paper-2 text-ink",
];

function logoClass(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return LOGOS[h % LOGOS.length];
}

function initials(company: string) {
  return (
    company
      .split(/\s|&/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
}

function formatDate(d: string) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  if (!y || !m || !day) return d;
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  );
}

const ROW_GRID = "md:grid-cols-[2.2fr_1.3fr_1.1fr_1.2fr_44px]";

export default function TrackerPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState<string | undefined>();
  // Display-only state for the new design
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function loadApplications() {
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .order("date_applied", { ascending: false });

    if (!error && data) setApplications(data);
    setLoading(false);
  }

  useEffect(() => {
    async function checkUserAndLoad() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }
      setEmail(data.user.email);
      loadApplications();
    }
    checkUserAndLoad();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    await supabase.from("applications").insert({
      company,
      role,
      user_id: data.user.id,
    });

    setCompany("");
    setRole("");
    setShowAdd(false);
    loadApplications();
  }

  async function handleStatusChange(id: string, status: string) {
    await supabase.from("applications").update({ status }).eq("id", id);
    loadApplications();
  }

  async function handleDelete(id: string) {
    await supabase.from("applications").delete().eq("id", id);
    loadApplications();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="flex items-center gap-3 font-mono text-sm tracking-[0.08em] text-muted">
          <span className="h-2 w-2 animate-pulse-ring rounded-full bg-signal" />
          LOADING YOUR PIPELINE
        </div>
      </div>
    );
  }

  const counts = {
    total: applications.length,
    applied: applications.filter((a) => a.status === "applied").length,
    interview: applications.filter((a) => a.status === "interview").length,
    offer: applications.filter((a) => a.status === "offer").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
  };

  const countFor = (value: string) =>
    value === "all" ? counts.total : applications.filter((a) => a.status === value).length;

  const visible = applications.filter((a) => filter === "all" || a.status === filter);
  const selected = applications.find((a) => a.id === selectedId) ?? applications[0];
  const today = new Date()
    .toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
    .toUpperCase()
    .replace(",", " ·");

  const filters = [{ value: "all", label: "All", dot: "bg-ink" }, ...STATUSES];

  return (
    <div className="flex min-h-screen flex-col bg-paper font-body text-ink lg:flex-row">
      <Nav email={email} active="tracker" />

      <main className="flex min-w-0 flex-1 flex-col gap-7 px-6 py-9 lg:px-10">
        {/* ---------- Header ---------- */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="font-mono text-xs tracking-[0.1em] text-muted">{today}</div>
            <h1 className="font-display text-[44px] font-bold leading-none tracking-[-0.04em]">Applications</h1>
          </div>
          <button
            type="button"
            onClick={() => setShowAdd(!showAdd)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-signal px-[22px] py-3.5 text-[15px] font-semibold text-white transition hover:-translate-y-px hover:shadow-[0_10px_24px_-12px_rgba(42,69,214,0.8)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              {showAdd ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M12 5v14M5 12h14" />}
            </svg>
            {showAdd ? "Close" : "Add application"}
          </button>
        </div>

        {/* ---------- Add form ---------- */}
        {showAdd && (
          <form
            onSubmit={handleAdd}
            className="flex animate-fade-in flex-col gap-3.5 rounded-[18px] border-[1.5px] border-signal bg-card p-5 md:flex-row md:items-end"
          >
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="company" className="text-[13px] font-semibold">Company</label>
              <input
                id="company"
                placeholder="e.g. Northwind Labs"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required
                autoFocus
                className="h-[46px] rounded-xl border-[1.5px] border-line bg-white px-3.5 text-[15px] transition placeholder:text-faint focus:border-signal focus:shadow-[0_0_0_4px_rgba(42,69,214,0.15)] focus:outline-none"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="role" className="text-[13px] font-semibold">Role</label>
              <input
                id="role"
                placeholder="e.g. Frontend Engineer"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
                className="h-[46px] rounded-xl border-[1.5px] border-line bg-white px-3.5 text-[15px] transition placeholder:text-faint focus:border-signal focus:shadow-[0_0_0_4px_rgba(42,69,214,0.15)] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="h-[46px] cursor-pointer rounded-xl bg-ink px-[22px] text-[15px] font-semibold text-paper transition hover:-translate-y-px"
            >
              Save role
            </button>
          </form>
        )}

        {/* ---------- Stat tiles ---------- */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-card p-5">
            <div className="text-[13px] text-muted">Total tracked</div>
            <div className="font-display text-[40px] font-bold leading-none tracking-[-0.04em]">{counts.total}</div>
          </div>
          <div className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-card p-5">
            <div className="text-[13px] text-muted">Awaiting reply</div>
            <div className="font-display text-[40px] font-bold leading-none tracking-[-0.04em] text-signal">{counts.applied}</div>
          </div>
          <div className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-card p-5">
            <div className="text-[13px] text-muted">Interviews</div>
            <div className="font-display text-[40px] font-bold leading-none tracking-[-0.04em] text-amber-deep">{counts.interview}</div>
          </div>
          <div className="flex flex-col gap-2.5 rounded-[18px] bg-ink p-5 text-paper">
            <div className="text-[13px] text-fog">Offers</div>
            <div className="font-display text-[40px] font-bold leading-none tracking-[-0.04em] text-mint">{counts.offer}</div>
          </div>
        </div>

        {/* ---------- Pipeline bar + filters ---------- */}
        <div className="flex flex-col gap-2.5">
          {counts.total > 0 && (
            <div className="flex h-2.5 gap-[3px] overflow-hidden rounded-full">
              {STATUSES.map((s) => (
                <div
                  key={s.value}
                  className="h-2.5 transition-[width] duration-700"
                  style={{ width: `${(countFor(s.value) / counts.total) * 100}%`, background: s.hex }}
                />
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => {
              const on = filter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  aria-pressed={on}
                  className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-4 text-sm font-medium transition ${
                    on ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink hover:border-ink"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${on && f.value === "all" ? "bg-paper" : f.dot}`} />
                  {f.label}
                  <span className="font-mono text-xs opacity-75">{countFor(f.value)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ---------- List + detail panel ---------- */}
        <div className="flex flex-col gap-5 xl:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {visible.length > 0 && (
              <div className={`hidden gap-4 px-[18px] font-mono text-[11px] tracking-[0.08em] text-muted md:grid ${ROW_GRID}`}>
                <span>ROLE</span>
                <span>STATUS</span>
                <span>APPLIED</span>
                <span>MATCH</span>
                <span />
              </div>
            )}

            {visible.map((app, i) => {
              const s = statusInfo(app.status);
              const isSel = selected?.id === app.id;
              return (
                <div
                  key={app.id}
                  className={`grid animate-fade-in grid-cols-1 items-center gap-4 rounded-2xl border-[1.5px] px-[18px] py-3.5 transition hover:shadow-[0_10px_24px_-18px_rgba(20,22,27,0.45)] ${ROW_GRID} ${
                    isSel ? "border-signal bg-white" : "border-paper-2 bg-card"
                  }`}
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(app.id)}
                    className="flex min-w-0 cursor-pointer items-center gap-3.5 text-left"
                  >
                    <span className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl font-display text-[15px] font-bold ${logoClass(app.id)}`}>
                      {initials(app.company)}
                    </span>
                    <span className="flex min-w-0 flex-col gap-[3px]">
                      <span className="truncate text-[15px] font-semibold">{app.role}</span>
                      <span className="truncate text-[13px] text-muted">{app.company}</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusChange(app.id, nextStatus(app.status))}
                    title="Click to advance status"
                    aria-label={`Status: ${s.label}. Click to move to ${statusInfo(nextStatus(app.status)).label}`}
                    className={`inline-flex min-h-8 cursor-pointer items-center gap-[7px] justify-self-start rounded-full px-3 text-[13px] font-semibold transition hover:brightness-95 ${s.chip}`}
                  >
                    <span className={`h-[7px] w-[7px] rounded-full ${s.dot}`} />
                    {s.label}
                  </button>

                  <span className="text-sm text-ink-2">{formatDate(app.date_applied)}</span>

                  <span className="flex items-center gap-2.5">
                    <span className="h-1.5 flex-1 rounded-full border border-dashed border-line" />
                    <span className="w-[34px] font-mono text-xs text-faint">Soon</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => handleDelete(app.id)}
                    aria-label={`Delete ${app.role} at ${app.company}`}
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] text-faint transition hover:bg-rust-soft hover:text-rust-ink"
                  >
                    <TrashIcon />
                  </button>
                </div>
              );
            })}

            {applications.length === 0 && (
              <div className="flex flex-col items-center gap-4 rounded-[18px] border-[1.5px] border-dashed border-line p-12 text-center">
                <p className="text-[15px] text-muted">Nothing tracked yet. Add your first application.</p>
                <button
                  type="button"
                  onClick={() => setShowAdd(true)}
                  className="cursor-pointer rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper"
                >
                  Add application
                </button>
              </div>
            )}

            {applications.length > 0 && visible.length === 0 && (
              <div className="rounded-[18px] border-[1.5px] border-dashed border-line p-12 text-center text-[15px] text-muted">
                Nothing here yet. Try another filter or add a role.
              </div>
            )}
          </div>

          {/* ---------- Detail panel ---------- */}
          {selected && (
            <aside
              key={selected.id}
              aria-label="Application details"
              className="flex animate-slide-in flex-col gap-5 self-start rounded-3xl bg-ink bg-dots p-7 text-paper xl:sticky xl:top-9 xl:w-[340px] xl:shrink-0"
            >
              <div className="flex flex-col gap-1.5">
                <div className="font-mono text-[11px] tracking-[0.1em] text-mist">{selected.company.toUpperCase()}</div>
                <div className="font-display text-[28px] font-bold leading-[1.1] tracking-[-0.03em]">{selected.role}</div>
                <div className="text-[13px] text-fog">Applied {formatDate(selected.date_applied)}</div>
              </div>

              <div className="flex items-center gap-5 rounded-[18px] bg-ink-soft p-[18px]">
                <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
                  <svg width="96" height="96" viewBox="0 0 120 120" aria-hidden="true" className="absolute">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#2E323C" strokeWidth="10" />
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#7C93FF" strokeWidth="2" strokeDasharray="4 8" opacity="0.6" />
                  </svg>
                  <span className="font-display text-[26px] font-bold text-mist">—</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="font-semibold">Résumé match</div>
                  <div className="text-[13px] leading-[1.45] text-fog">Scoring arrives with the AI sprint.</div>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="text-[13px] font-semibold">Status</div>
                <div className="grid grid-cols-2 gap-2">
                  {STATUSES.map((s) => {
                    const on = selected.status === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => handleStatusChange(selected.id, s.value)}
                        aria-pressed={on}
                        className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-xl px-3 text-[13px] font-semibold transition ${
                          on ? "bg-paper text-ink" : "border border-ink-border text-fog hover:bg-ink-raised"
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-2 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => handleStatusChange(selected.id, nextStatus(selected.status))}
                  className="min-h-12 cursor-pointer rounded-[14px] bg-paper text-[15px] font-semibold text-ink transition hover:-translate-y-px"
                >
                  Advance to {statusInfo(nextStatus(selected.status)).label}
                </button>
                <button
                  type="button"
                  disabled
                  className="min-h-12 rounded-[14px] border border-ink-border text-[15px] font-medium text-mist"
                >
                  Tailor résumé · coming soon
                </button>
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}