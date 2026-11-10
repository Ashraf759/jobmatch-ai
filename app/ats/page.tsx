"use client";

// ATS Scanner: every ATS check in one place, plus a quick way to run a new scan
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Nav from "@/components/Nav";
import { Card, EmptyState, Loading, PageHeader, Sparkline, StatTile, formatDate, tone } from "@/components/ui";
import { STEP_LABEL, runPipeline, type Step } from "@/utils/pipeline";

type Category = { key: string; label: string; points: number; max: number };
type Report = {
  id: string;
  match_id: string;
  score: number;
  is_demo: boolean;
  created_at: string;
  result: { categories?: Category[]; keywords?: { found: boolean }[] };
};
type MatchInfo = { id: string; resume_name: string; job_title: string; company: string | null };
type ResumeOpt = { id: string; file_name: string; label: string | null; is_default: boolean };
type JobOpt = { id: string; title: string; company: string | null };

const selectClass =
  "h-11 w-full cursor-pointer rounded-xl border-[1.5px] border-line bg-white px-3 text-[15px] focus:border-signal focus:outline-none";

function atsLabel(score: number) {
  if (score >= 80) return "ATS friendly";
  if (score >= 60) return "Mostly readable";
  return "Needs work";
}

export default function AtsScannerPage() {
  const [email, setEmail] = useState<string | undefined>();
  const [reports, setReports] = useState<Report[]>([]);
  const [matches, setMatches] = useState<Map<string, MatchInfo>>(new Map());
  const [resumes, setResumes] = useState<ResumeOpt[]>([]);
  const [jobs, setJobs] = useState<JobOpt[]>([]);
  const [resumeId, setResumeId] = useState("");
  const [jobId, setJobId] = useState("");
  const [step, setStep] = useState<Step | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      const [{ data: r }, { data: m }, { data: rs }, { data: js }] = await Promise.all([
        supabase
          .from("ai_reports")
          .select("id, match_id, score, is_demo, created_at, result")
          .eq("kind", "ats")
          .order("created_at", { ascending: false }),
        supabase.from("match_results").select("id, resume_name, job_title, company"),
        supabase
          .from("resumes")
          .select("id, file_name, label, is_default")
          .order("is_default", { ascending: false })
          .order("uploaded_at", { ascending: false }),
        supabase.from("job_postings").select("id, title, company").order("created_at", { ascending: false }),
      ]);
      setReports((r ?? []) as Report[]);
      setMatches(new Map(((m ?? []) as MatchInfo[]).map((x) => [x.id, x])));
      const rl = (rs ?? []) as ResumeOpt[];
      const jl = (js ?? []) as JobOpt[];
      setResumes(rl);
      setJobs(jl);
      setResumeId(rl[0]?.id ?? "");
      setJobId(jl[0]?.id ?? "");
      setLoading(false);
    }
    load();
  }, []);

  async function scan() {
    if (!resumeId || !jobId) return;
    setError(null);
    try {
      const { matchId, warning } = await runPipeline(resumeId, jobId, setStep, { ats: true, tailor: false });
      if (warning) {
        setError(warning);
        setStep(null);
        return;
      }
      router.push(`/match/${matchId}#ats`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The scan failed. Please try again.");
      setStep(null);
    }
  }

  if (loading) return <Loading label="LOADING ATS SCANNER" />;

  const scores = reports.map((r) => r.score);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const best = scores.length ? Math.max(...scores) : null;
  const friendly = scores.filter((s) => s >= 80).length;
  const running = !!step && step !== "done";

  // Which part of the score is weakest on average
  const totals = new Map<string, { label: string; got: number; max: number }>();
  for (const r of reports)
    for (const c of r.result?.categories ?? []) {
      const t = totals.get(c.key) ?? { label: c.label, got: 0, max: 0 };
      t.got += c.points;
      t.max += c.max;
      totals.set(c.key, t);
    }
  const weakest = [...totals.values()].sort((a, b) => a.got / a.max - b.got / b.max)[0];

  return (
    <div className="flex min-h-screen flex-col bg-paper font-body text-ink lg:flex-row">
      <Nav email={email} active="ats" />
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-6 py-9 lg:px-10">
        <PageHeader
          title="ATS Scanner"
          subtitle="See how applicant tracking software reads your résumé for a specific job. Every scan is saved here so you can track your progress."
        />

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile label="Scans run" value={reports.length} />
          <StatTile label="Average ATS score" value={avg ?? "—"} hint={avg !== null ? atsLabel(avg) : "No scans yet"} />
          <StatTile label="Best score" value={best ?? "—"} accent="text-green" />
          <StatTile label="ATS friendly (80+)" value={friendly} hint={weakest ? `Weakest area: ${weakest.label}` : ""} dark accent="text-mint" />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
          <Card title="NEW SCAN">
            {resumes.length === 0 || jobs.length === 0 ? (
              <EmptyState text="You need at least one résumé and one saved job to run a scan." href={resumes.length ? "/jobs" : "/resumes"} cta={resumes.length ? "Add a job" : "Upload a résumé"} />
            ) : (
              <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                  Résumé
                  <select value={resumeId} onChange={(e) => setResumeId(e.target.value)} className={selectClass}>
                    {resumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {`${r.label || r.file_name}${r.is_default ? " · default" : ""}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                  Job posting
                  <select value={jobId} onChange={(e) => setJobId(e.target.value)} className={selectClass}>
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.company ? `${j.title} · ${j.company}` : j.title}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={scan}
                  disabled={running}
                  className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-signal px-6 text-[15px] font-semibold text-white transition hover:-translate-y-px disabled:cursor-wait disabled:opacity-70"
                >
                  {running && <span className="h-2 w-2 animate-pulse-ring rounded-full bg-white" />}
                  {running ? (step === "ats" ? "Scanning…" : STEP_LABEL[step!]) : "Run scan"}
                </button>
              </div>
            )}
            {error && <p role="alert" className="rounded-xl bg-rust-soft px-4 py-3 text-sm text-rust-ink">{error}</p>}
          </Card>
          <Card title="SCORE TREND">
            <Sparkline values={[...scores].reverse()} />
            <p className="text-[13px] text-muted">Your ATS scores over time, oldest to newest.</p>
          </Card>
        </div>

        <Card title={`SCAN HISTORY · ${reports.length}`}>
          {reports.length === 0 && <EmptyState text="No scans yet. Run your first one above." />}
          <div className="flex flex-col gap-2">
            {reports.map((r) => {
              const m = matches.get(r.match_id);
              const t = tone(r.score);
              const cats = r.result?.categories ?? [];
              const weak = [...cats].sort((a, b) => a.points / a.max - b.points / b.max)[0];
              const kw = r.result?.keywords ?? [];
              return (
                <Link
                  key={r.id}
                  href={`/match/${r.match_id}#ats`}
                  className="flex flex-wrap items-center gap-4 rounded-2xl border-[1.5px] border-paper-2 bg-card px-4 py-3 transition hover:border-line hover:shadow-[0_10px_24px_-18px_rgba(20,22,27,0.45)]"
                >
                  <span className={`flex h-11 w-14 shrink-0 items-center justify-center rounded-xl font-display text-lg font-bold ${t.soft} ${t.text}`}>{r.score}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-semibold">
                      {m ? (m.company ? `${m.job_title} · ${m.company}` : m.job_title) : "Job posting"}
                    </span>
                    <span className="truncate text-[13px] text-muted">
                      {atsLabel(r.score)} · {m?.resume_name ?? "Résumé"} · {formatDate(r.created_at)}
                      {r.is_demo ? " · DEMO" : ""}
                    </span>
                  </span>
                  {kw.length > 0 && (
                    <span className="font-mono text-[12px] text-muted">
                      {kw.filter((k) => k.found).length}/{kw.length} KEYWORDS
                    </span>
                  )}
                  {weak && <span className="hidden rounded-full bg-paper-2 px-3 py-1 text-[12px] text-ink-2 md:inline">Fix: {weak.label}</span>}
                  <span className="text-sm font-semibold text-signal">Open →</span>
                </Link>
              );
            })}
          </div>
        </Card>
      </main>
    </div>
  );
}
