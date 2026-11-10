"use client";

// Résumé Studio: everything about one résumé version in one place
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Nav from "@/components/Nav";
import { Card, EmptyState, Loading, Meter, ScoreRing, Sparkline, StatTile, formatDate, tone } from "@/components/ui";
import type { HealthReport } from "@/utils/resumeHealth";
import { STEP_LABEL, runHealth, runPipeline, type Step } from "@/utils/pipeline";
import { createTailoredCopy, downloadBlob } from "@/utils/autoCopy";

type Resume = {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  uploaded_at: string;
  label: string | null;
  is_default: boolean;
  health: HealthReport | null;
  health_score: number | null;
};
type Job = { id: string; title: string; company: string | null };
type MatchRow = { id: string; job_title: string; company: string | null; score: number; created_at: string };
type AtsRow = { id: string; match_id: string; score: number; created_at: string };

const LEVEL = {
  high: { label: "HIGH", cls: "bg-rust-soft text-rust-ink" },
  medium: { label: "MEDIUM", cls: "bg-amber-soft text-amber-ink" },
  low: { label: "LOW", cls: "bg-paper-2 text-ink-2" },
};

export default function ResumeStudioPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [email, setEmail] = useState<string | undefined>();
  const [resume, setResume] = useState<Resume | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [ats, setAts] = useState<AtsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [jobId, setJobId] = useState("");
  const [step, setStep] = useState<Step | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function load() {
    const { data: r } = await supabase.from("resumes").select("*").eq("id", id).maybeSingle();
    if (!r) {
      setLoading(false);
      return;
    }
    setResume(r as Resume);

    const [{ data: j }, { data: m }] = await Promise.all([
      supabase.from("job_postings").select("id, title, company").order("created_at", { ascending: false }),
      supabase
        .from("match_results")
        .select("id, job_title, company, score, created_at")
        .eq("resume_id", id)
        .order("created_at", { ascending: true }),
    ]);
    const jobList = (j ?? []) as Job[];
    const matchList = (m ?? []) as MatchRow[];
    setJobs(jobList);
    setJobId((prev) => prev || jobList[0]?.id || "");
    setMatches(matchList);

    if (matchList.length) {
      const { data: a } = await supabase
        .from("ai_reports")
        .select("id, match_id, score, created_at")
        .eq("kind", "ats")
        .in(
          "match_id",
          matchList.map((x) => x.id),
        )
        .order("created_at", { ascending: true });
      setAts((a ?? []) as AtsRow[]);
    }
    setLoading(false);

    // First visit: build the health report automatically
    if (!r.health) analyze();
  }

  useEffect(() => {
    async function start() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }
      setEmail(data.user.email);
      load();
    }
    if (id) start();
  }, [id]);

  async function analyze() {
    setAnalyzing(true);
    setError(null);
    try {
      const { health } = await runHealth(id);
      setResume((prev) => (prev ? { ...prev, health, health_score: health.score } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't analyze this résumé.");
    }
    setAnalyzing(false);
  }

  async function autoTailor() {
    if (!jobId) return;
    setError(null);
    try {
      const { matchId, warning } = await runPipeline(id, jobId, setStep);
      if (warning) {
        setError(warning);
        router.push(`/match/${matchId}#tailor`);
        return;
      }
      setStep("copy");
      try {
        const copy = await createTailoredCopy(supabase, id, matchId);
        downloadBlob(copy.blob, copy.fileName);
        router.push(`/tailor/${copy.reportId}?saved=${copy.newResumeId}`);
      } catch {
        router.push(`/match/${matchId}#tailor`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStep(null);
    }
  }

  async function openFile() {
    if (!resume) return;
    const tab = window.open("", "_blank");
    const { data } = await supabase.storage.from("resumes").download(resume.file_path);
    if (!data) {
      tab?.close();
      return;
    }
    const isPdf = resume.file_name.toLowerCase().endsWith(".pdf");
    const url = URL.createObjectURL(isPdf ? new Blob([data], { type: "application/pdf" }) : data);
    if (isPdf && tab) tab.location.href = url;
    else {
      tab?.close();
      const a = document.createElement("a");
      a.href = url;
      a.download = resume.file_name;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  if (loading) return <Loading label="OPENING RÉSUMÉ STUDIO" />;

  if (!resume) {
    return (
      <div className="flex min-h-screen flex-col bg-paper font-body text-ink lg:flex-row">
        <Nav email={email} active="resumes" />
        <main className="flex flex-1 flex-col gap-4 px-6 py-9 lg:px-10">
          <EmptyState text="This résumé was not found. It may have been deleted." href="/resumes" cta="Back to Résumés" />
        </main>
      </div>
    );
  }

  const h = resume.health;
  const best = matches.length ? Math.max(...matches.map((m) => m.score)) : null;
  const avg = matches.length ? Math.round(matches.reduce((s, m) => s + m.score, 0) / matches.length) : null;
  const atsByMatch = new Map(ats.map((a) => [a.match_id, a.score]));

  return (
    <div className="flex min-h-screen flex-col bg-paper font-body text-ink lg:flex-row">
      <Nav email={email} active="resumes" />

      <main className="flex min-w-0 flex-1 flex-col gap-6 px-6 py-9 lg:px-10">
        <Link href="/resumes" className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted hover:text-ink">
          ← Back to Résumés
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="font-mono text-xs tracking-[0.1em] text-muted">RÉSUMÉ STUDIO</div>
            <h1 className="flex flex-wrap items-center gap-3 font-display text-[40px] font-bold leading-[1.05] tracking-[-0.04em]">
              {resume.label || resume.file_name}
              {resume.is_default && (
                <span className="rounded-full bg-signal-soft px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.08em] text-signal-deep">
                  DEFAULT
                </span>
              )}
            </h1>
            <p className="text-[15px] text-ink-2">
              {resume.file_name} · Uploaded {formatDate(resume.uploaded_at)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openFile}
              className="min-h-11 cursor-pointer rounded-full border-[1.5px] border-line px-4 text-sm font-medium transition hover:border-ink"
            >
              View file
            </button>
            <button
              type="button"
              onClick={analyze}
              disabled={analyzing}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-paper transition hover:-translate-y-px disabled:opacity-60"
            >
              {analyzing && <span className="h-2 w-2 animate-pulse-ring rounded-full bg-paper" />}
              {analyzing ? "Analyzing…" : "Re-analyze"}
            </button>
          </div>
        </div>

        {error && <p role="alert" className="rounded-xl bg-rust-soft px-4 py-3 text-sm text-rust-ink">{error}</p>}

        {/* ---------- Stats ---------- */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile label="Health score" value={h ? h.score : "—"} hint={h ? h.grade : "Analyzing…"} dark accent="text-mint" />
          <StatTile label="Jobs matched" value={matches.length} hint="with this version" />
          <StatTile label="Best match" value={best !== null ? `${best}%` : "—"} hint={avg !== null ? `Average ${avg}%` : "No matches yet"} />
          <StatTile
            label="Bullet points with numbers"
            value={h && h.stats.bullets ? `${Math.round((h.stats.quantified / h.stats.bullets) * 100)}%` : "—"}
            hint={h ? `${h.stats.quantified} of ${h.stats.bullets}` : ""}
          />
        </div>

        {/* ---------- Health report ---------- */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_1fr]">
          <Card title="HEALTH REPORT">
            {h ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <ScoreRing score={h.score} label="OUT OF 100" />
                <span className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${tone(h.score).soft} ${tone(h.score).text}`}>{h.grade}</span>
                <p className="text-[13px] text-muted">
                  Checked automatically when you uploaded it. Free, and based on clear rules, so you can see where every point comes from.
                </p>
                <div className="font-mono text-[10px] tracking-[0.1em] text-muted">CHECKED {formatDate(h.checked_at).toUpperCase()}</div>
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-muted">Reading your résumé…</div>
            )}
          </Card>
          <Card title="BREAKDOWN">
            {h ? (
              <div className="flex flex-col gap-4">
                {h.categories.map((c) => (
                  <Meter key={c.key} label={c.label} points={c.points} max={c.max} note={c.note} />
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted">Working on it…</div>
            )}
          </Card>
        </div>

        {h && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
            <Card title={`WHAT TO FIX · ${h.issues.length}`}>
              {h.issues.length === 0 && <p className="text-sm text-muted">Nothing important to fix. Nice work.</p>}
              <ul className="flex flex-col gap-2.5">
                {h.issues.map((issue, i) => (
                  <li key={i} className="flex flex-col gap-1.5 rounded-2xl bg-paper p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.08em] ${LEVEL[issue.level].cls}`}>
                        {LEVEL[issue.level].label}
                      </span>
                      <span className="text-[15px] font-semibold">{issue.title}</span>
                    </div>
                    <p className="text-[14px] text-ink-2">{issue.detail}</p>
                    {issue.examples && issue.examples.length > 0 && (
                      <div className="flex flex-col gap-1 pt-1">
                        {issue.examples.map((ex) => (
                          <span key={ex} className="rounded-lg bg-card px-2.5 py-1.5 text-[13px] text-muted">
                            “{ex}”
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
            <div className="flex flex-col gap-5">
              <Card title="STRENGTHS">
                {h.strengths.length === 0 && <p className="text-sm text-muted">Fix the items on the left to build strengths.</p>}
                <ul className="flex flex-col gap-2">
                  {h.strengths.map((s) => (
                    <li key={s} className="flex gap-2 text-[14px]">
                      <span className="text-green">✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </Card>
              <Card title="AT A GLANCE">
                <div className="grid grid-cols-2 gap-3 text-[14px]">
                  <div><div className="font-display text-2xl font-bold">{h.stats.words}</div><div className="text-muted">words</div></div>
                  <div><div className="font-display text-2xl font-bold">{h.stats.pages}</div><div className="text-muted">page{h.stats.pages === 1 ? "" : "s"}</div></div>
                  <div><div className="font-display text-2xl font-bold">{h.stats.bullets}</div><div className="text-muted">bullet points</div></div>
                  <div><div className="font-display text-2xl font-bold">{h.stats.actionVerbStarts}</div><div className="text-muted">start with a verb</div></div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ---------- Auto-tailor ---------- */}
        <Card title="AUTO-TAILOR FOR A JOB">
          <p className="text-[14px] text-ink-2">
            Pick a saved job. In one click, JobMatch matches this résumé to it, runs the ATS check, rewrites your bullet points, and gives you a tailored copy as a Word file. The copy is also saved as a new version.
          </p>
          {jobs.length === 0 ? (
            <EmptyState text="Save a job posting first." href="/jobs" cta="Add a job" />
          ) : (
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <select
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                aria-label="Job posting"
                className="h-11 min-w-0 flex-1 cursor-pointer rounded-xl border-[1.5px] border-line bg-white px-3 text-[15px]"
              >
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.company ? `${j.title} · ${j.company}` : j.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={autoTailor}
                disabled={!!step && step !== "done"}
                className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-signal px-6 text-sm font-semibold text-white transition hover:-translate-y-px disabled:cursor-wait disabled:opacity-70"
              >
                {step && step !== "done" && <span className="h-2 w-2 animate-pulse-ring rounded-full bg-white" />}
                {step && step !== "done" ? STEP_LABEL[step] : "Auto-tailor"}
              </button>
            </div>
          )}
        </Card>

        {/* ---------- History ---------- */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
          <Card title={`MATCH HISTORY · ${matches.length}`}>
            {matches.length === 0 && <p className="text-sm text-muted">This version hasn’t been matched to a job yet.</p>}
            <div className="flex flex-col gap-2">
              {[...matches].reverse().map((m) => {
                const t = tone(m.score);
                const a = atsByMatch.get(m.id);
                return (
                  <Link
                    key={m.id}
                    href={`/match/${m.id}`}
                    className="flex flex-wrap items-center gap-3 rounded-2xl bg-paper px-4 py-3 transition hover:bg-paper-2"
                  >
                    <span className={`flex h-10 w-12 items-center justify-center rounded-xl font-display font-bold ${t.soft} ${t.text}`}>{m.score}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-semibold">{m.company ? `${m.job_title} · ${m.company}` : m.job_title}</span>
                      <span className="text-[12px] text-muted">{formatDate(m.created_at)}</span>
                    </span>
                    {a !== undefined && <span className="font-mono text-[12px] text-muted">ATS {a}</span>}
                    <span className="text-sm font-semibold text-signal">Open →</span>
                  </Link>
                );
              })}
            </div>
          </Card>
          <Card title="MATCH SCORE TREND">
            <Sparkline values={matches.map((m) => m.score)} />
            <p className="text-[13px] text-muted">Each point is one match with this version, oldest to newest.</p>
          </Card>
        </div>
      </main>
    </div>
  );
}
