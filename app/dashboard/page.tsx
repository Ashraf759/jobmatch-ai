"use client";

// Dashboard (SCRUM-35): your whole job search at a glance
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Nav from "@/components/Nav";
import { BarList, Card, Columns, Loading, StatTile, formatDate, todayLabel, tone } from "@/components/ui";

type App = {
  id: string;
  company: string;
  role: string;
  status: string;
  date_applied: string;
  follow_up_date: string | null;
};
type MatchRow = { id: string; job_title: string; company: string | null; score: number; created_at: string };
type ReportRow = { id: string; kind: string; score: number | null; match_id: string; created_at: string };
type ResumeRow = { id: string; label: string | null; file_name: string; health_score: number | null };

const STATUS = [
  { value: "saved", label: "Saved", hex: "#6B6F7A" },
  { value: "applied", label: "Applied", hex: "#2A45D6" },
  { value: "interview", label: "Interview", hex: "#F0A93B" },
  { value: "offer", label: "Offer", hex: "#1E7A5C" },
  { value: "rejected", label: "Rejected", hex: "#A8412F" },
];

const KIND_LABEL: Record<string, string> = { ats: "ATS check", tailor: "Tailored résumé", cover_letter: "Cover letter" };

function dayKey(d: Date) {
  // local date, not UTC, so "today" matches the user's clock
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function weekStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x;
}

export default function DashboardPage() {
  const [email, setEmail] = useState<string | undefined>();
  const [apps, setApps] = useState<App[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [resumes, setResumes] = useState<ResumeRow[]>([]);
  const [jobsCount, setJobsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }
      setEmail(auth.user.email);
      const [a, m, r, rs, j] = await Promise.all([
        supabase.from("applications").select("*").order("date_applied", { ascending: false }),
        supabase.from("match_results").select("id, job_title, company, score, created_at").order("created_at", { ascending: false }),
        supabase.from("ai_reports").select("id, kind, score, match_id, created_at").order("created_at", { ascending: false }),
        supabase.from("resumes").select("id, label, file_name, health_score"),
        supabase.from("job_postings").select("id", { count: "exact", head: true }),
      ]);
      setApps((a.data ?? []) as App[]);
      setMatches((m.data ?? []) as MatchRow[]);
      setReports((r.data ?? []) as ReportRow[]);
      setResumes((rs.data ?? []) as ResumeRow[]);
      setJobsCount(j.count ?? 0);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Loading label="LOADING YOUR DASHBOARD" />;

  const count = (s: string) => apps.filter((a) => a.status === s).length;
  const sent = apps.filter((a) => a.status !== "saved").length;
  const interviews = count("interview") + count("offer");
  const interviewRate = sent ? Math.round((interviews / sent) * 100) : 0;
  const avgMatch = matches.length ? Math.round(matches.reduce((s, m) => s + m.score, 0) / matches.length) : null;
  const atsScores = reports.filter((r) => r.kind === "ats" && r.score !== null).map((r) => r.score as number);
  const avgAts = atsScores.length ? Math.round(atsScores.reduce((a, b) => a + b, 0) / atsScores.length) : null;
  const healthy = resumes.filter((r) => r.health_score !== null);
  const bestResume = [...healthy].sort((a, b) => (b.health_score ?? 0) - (a.health_score ?? 0))[0];

  // Applications added per week, last 8 weeks
  const thisWeek = weekStart(new Date());
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - (7 - i) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const value = apps.filter((a) => {
      const d = new Date(`${String(a.date_applied).slice(0, 10)}T00:00:00`);
      return d >= start && d < end;
    }).length;
    return { label: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }), value };
  });

  // Reminders (SCRUM-36): follow-ups due in the next 7 days or overdue
  const today = dayKey(new Date());
  const in7 = dayKey(new Date(Date.now() + 7 * 864e5));
  const reminders = apps
    .filter((a) => a.follow_up_date && a.follow_up_date <= in7 && !["offer", "rejected"].includes(a.status))
    .sort((a, b) => String(a.follow_up_date).localeCompare(String(b.follow_up_date)));

  // Recent AI activity
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const activity = [
    ...matches.slice(0, 6).map((m) => ({ id: m.id, when: m.created_at, label: "AI Match", title: m.job_title, company: m.company, score: m.score as number | null, href: `/match/${m.id}` })),
    ...reports.slice(0, 6).map((r) => {
      const m = matchById.get(r.match_id);
      const href = r.kind === "tailor" ? `/tailor/${r.id}` : r.kind === "cover_letter" ? "/cover-letters" : `/match/${r.match_id}#ats`;
      return { id: r.id, when: r.created_at, label: KIND_LABEL[r.kind] ?? r.kind, title: m?.job_title ?? "Job", company: m?.company ?? null, score: r.score, href };
    }),
  ]
    .sort((a, b) => b.when.localeCompare(a.when))
    .slice(0, 7);

  return (
    <div className="flex min-h-screen flex-col bg-paper font-body text-ink lg:flex-row">
      <Nav email={email} active="dashboard" />
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-6 py-9 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="font-mono text-xs tracking-[0.1em] text-muted">{todayLabel()}</div>
            <h1 className="font-display text-[44px] font-bold leading-none tracking-[-0.04em]">Welcome back.</h1>
            <p className="pt-1 text-[17px] text-ink-2">Here’s where your job search stands today.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/resumes" className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-line px-4 text-sm font-medium hover:border-ink">
              Upload résumé
            </Link>
            <Link href="/jobs" className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-line px-4 text-sm font-medium hover:border-ink">
              Save a job
            </Link>
            <Link href="/match" className="inline-flex min-h-11 items-center rounded-full bg-signal px-5 text-sm font-semibold text-white hover:-translate-y-px">
              Run AI Match
            </Link>
          </div>
        </div>

        {/* ---------- Key numbers ---------- */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Applications" value={apps.length} hint={`${sent} sent`} />
          <StatTile label="Interview rate" value={`${interviewRate}%`} hint={`${interviews} interviews or offers`} accent="text-amber-deep" />
          <StatTile label="Offers" value={count("offer")} accent="text-green" />
          <StatTile label="Avg match score" value={avgMatch !== null ? `${avgMatch}%` : "—"} hint={`${matches.length} matches`} accent="text-signal" />
          <StatTile label="Avg ATS score" value={avgAts ?? "—"} hint={`${atsScores.length} scans`} />
          <StatTile label="Best résumé health" value={bestResume?.health_score ?? "—"} hint={bestResume ? bestResume.label || bestResume.file_name : "Upload a résumé"} dark accent="text-mint" />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr]">
          <Card title="APPLICATIONS PER WEEK" right={<span className="font-mono text-[11px] text-muted">LAST 8 WEEKS</span>}>
            <Columns items={weeks} />
          </Card>
          <Card title="PIPELINE">
            <div className="flex h-3 gap-[3px] overflow-hidden rounded-full bg-paper-2">
              {apps.length > 0 &&
                STATUS.map((s) => (
                  <div key={s.value} style={{ width: `${(count(s.value) / apps.length) * 100}%`, background: s.hex }} />
                ))}
            </div>
            <div className="flex flex-col gap-2">
              {STATUS.map((s) => (
                <Link key={s.value} href="/tracker" className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-[14px] hover:bg-paper">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.hex }} />
                  <span className="flex-1">{s.label}</span>
                  <span className="font-mono text-[13px] text-muted">{count(s.value)}</span>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {/* ---------- Reminders ---------- */}
          <Card title={`FOLLOW-UPS · ${reminders.length}`} right={<Link href="/tracker" className="text-[13px] font-semibold text-signal">Tracker →</Link>}>
            {reminders.length === 0 ? (
              <p className="text-[14px] text-muted">Nothing due this week. Set follow-up dates on any application in the tracker.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {reminders.map((a) => {
                  const overdue = String(a.follow_up_date) < today;
                  const due = String(a.follow_up_date) === today;
                  return (
                    <Link key={a.id} href={`/tracker?app=${a.id}`} className="flex items-center gap-3 rounded-2xl bg-paper px-4 py-3 hover:bg-paper-2">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[14px] font-semibold">{a.role}</span>
                        <span className="truncate text-[12px] text-muted">{a.company}</span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold ${
                          overdue ? "bg-rust-soft text-rust-ink" : due ? "bg-amber-soft text-amber-ink" : "bg-signal-soft text-signal-deep"
                        }`}
                      >
                        {overdue ? "OVERDUE" : due ? "TODAY" : formatDate(a.follow_up_date).toUpperCase()}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>

          {/* ---------- Activity ---------- */}
          <Card title="RECENT AI ACTIVITY">
            {activity.length === 0 && <p className="text-[14px] text-muted">Nothing yet. Run your first AI Match.</p>}
            <div className="flex flex-col gap-1">
              {activity.map((x) => (
                <Link key={x.id} href={x.href} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-paper">
                  <span className="w-[108px] shrink-0 font-mono text-[10px] tracking-[0.06em] text-muted">{x.label.toUpperCase()}</span>
                  <span className="min-w-0 flex-1 truncate text-[14px]">
                    {x.title}
                    {x.company ? <span className="text-muted"> · {x.company}</span> : null}
                  </span>
                  {x.score !== null && x.score !== undefined && (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${tone(x.score).soft} ${tone(x.score).text}`}>{x.score}</span>
                  )}
                </Link>
              ))}
            </div>
          </Card>

          {/* ---------- Résumé health ---------- */}
          <Card title="RÉSUMÉ HEALTH" right={<Link href="/resumes" className="text-[13px] font-semibold text-signal">Résumés →</Link>}>
            {healthy.length === 0 ? (
              <p className="text-[14px] text-muted">Upload a résumé to get a free health report.</p>
            ) : (
              <BarList
                items={[...healthy]
                  .sort((a, b) => (b.health_score ?? 0) - (a.health_score ?? 0))
                  .slice(0, 6)
                  .map((r) => ({ label: r.label || r.file_name, value: r.health_score ?? 0 }))}
                max={100}
                color="bg-green"
              />
            )}
          </Card>
        </div>

        {/* ---------- Toolkit ---------- */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[
            { href: "/jobs", t: "Job postings", d: `${jobsCount} saved` },
            { href: "/match", t: "AI Match", d: `${matches.length} results` },
            { href: "/ats", t: "ATS Scanner", d: `${atsScores.length} scans` },
            { href: "/tailor", t: "Tailoring Studio", d: `${reports.filter((r) => r.kind === "tailor").length} versions` },
            { href: "/cover-letters", t: "Cover Letters", d: `${reports.filter((r) => r.kind === "cover_letter").length} letters` },
            { href: "/insights", t: "Insights", d: "Skills to learn" },
          ].map((x) => (
            <Link
              key={x.href}
              href={x.href}
              className="flex flex-col gap-1 rounded-2xl border border-line bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-22px_rgba(20,22,27,0.4)]"
            >
              <span className="text-[15px] font-semibold">{x.t}</span>
              <span className="font-mono text-[11px] text-muted">{x.d.toUpperCase()}</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
