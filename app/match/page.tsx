"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Nav from "@/components/Nav";

type ResumeOption = { id: string; file_name: string };
type JobOption = { id: string; title: string; company: string | null };
type MatchRow = {
  id: string;
  resume_name: string;
  job_title: string;
  company: string | null;
  score: number;
  is_demo: boolean;
  created_at: string;
};

const selectClass =
  "h-[46px] w-full cursor-pointer rounded-xl border-[1.5px] border-line bg-white px-3 text-[15px] text-ink transition focus:border-signal focus:shadow-[0_0_0_4px_rgba(42,69,214,0.15)] focus:outline-none";

function scoreStyle(score: number) {
  if (score >= 85) return { label: "Strong", text: "text-green-ink", soft: "bg-green-soft" };
  if (score >= 70) return { label: "Good", text: "text-signal-deep", soft: "bg-signal-soft" };
  if (score >= 50) return { label: "Partial", text: "text-amber-ink", soft: "bg-amber-soft" };
  return { label: "Weak", text: "text-rust-ink", soft: "bg-rust-soft" };
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function MatchPage() {
  const [resumes, setResumes] = useState<ResumeOption[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | undefined>();
  const [resumeId, setResumeId] = useState("");
  const [jobId, setJobId] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function loadAll() {
    const [r, j, m] = await Promise.all([
      supabase.from("resumes").select("id, file_name").order("uploaded_at", { ascending: false }),
      supabase.from("job_postings").select("id, title, company").order("created_at", { ascending: false }),
      supabase
        .from("match_results")
        .select("id, resume_name, job_title, company, score, is_demo, created_at")
        .order("created_at", { ascending: false }),
    ]);
    const resumeList = (r.data ?? []) as ResumeOption[];
    const jobList = (j.data ?? []) as JobOption[];
    setResumes(resumeList);
    setJobs(jobList);
    setMatches((m.data ?? []) as MatchRow[]);
    setResumeId((prev) => prev || resumeList[0]?.id || "");
    setJobId((prev) => prev || jobList[0]?.id || "");
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
      loadAll();
    }
    checkUserAndLoad();
  }, []);

  async function handleAnalyze() {
    setError(null);
    if (!resumeId || !jobId) {
      setError("Pick a résumé and a job posting first.");
      return;
    }
    setRunning(true);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId, jobId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Something went wrong. Please try again.");
        setRunning(false);
        return;
      }
      router.push(`/match/${json.match.id}`); // open the full results page
    } catch {
      setError("We couldn’t reach the server. Check your connection and try again.");
      setRunning(false);
    }
  }

  async function handleDelete(match: MatchRow) {
    if (!window.confirm(`Delete this result for "${match.job_title}"?`)) return;
    await supabase.from("match_results").delete().eq("id", match.id);
    setMatches((prev) => prev.filter((m) => m.id !== match.id));
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="flex items-center gap-3 font-mono text-sm tracking-[0.08em] text-muted">
          <span className="h-2 w-2 animate-pulse-ring rounded-full bg-signal" />
          LOADING AI MATCH
        </div>
      </div>
    );
  }

  const today = new Date()
    .toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
    .toUpperCase()
    .replace(",", " ·");

  const ready = resumes.length > 0 && jobs.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-paper font-body text-ink lg:flex-row">
      <Nav email={email} active="match" />

      <main className="flex min-w-0 flex-1 flex-col gap-7 px-6 py-9 lg:px-10">
        {/* ---------- Header ---------- */}
        <div className="flex flex-col gap-1.5">
          <div className="font-mono text-xs tracking-[0.1em] text-muted">{today}</div>
          <h1 className="font-display text-[44px] font-bold leading-none tracking-[-0.04em]">AI Match</h1>
          <p className="max-w-[620px] pt-1 text-[17px] leading-normal text-ink-2">
            Compare a résumé with a job posting and see how well they fit, what’s missing, and what to improve.
          </p>
        </div>

        {/* ---------- Setup needed ---------- */}
        {!ready && (
          <div className="flex animate-fade-in flex-col gap-4 rounded-3xl border border-line bg-card p-8">
            <div className="font-display text-2xl font-bold tracking-[-0.02em]">Two things first</div>
            <p className="text-[15px] text-ink-2">To run a match, you need at least one résumé and one saved job posting.</p>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Link
                href="/resumes"
                className={`flex flex-1 items-center justify-between rounded-2xl border-[1.5px] px-5 py-4 text-[15px] font-semibold transition hover:border-ink ${
                  resumes.length > 0 ? "border-green bg-green-soft text-green-ink" : "border-line text-ink"
                }`}
              >
                {resumes.length > 0 ? "✓ Résumé uploaded" : "Upload a résumé"}
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/jobs"
                className={`flex flex-1 items-center justify-between rounded-2xl border-[1.5px] px-5 py-4 text-[15px] font-semibold transition hover:border-ink ${
                  jobs.length > 0 ? "border-green bg-green-soft text-green-ink" : "border-line text-ink"
                }`}
              >
                {jobs.length > 0 ? "✓ Job posting saved" : "Save a job posting"}
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        )}

        {/* ---------- Pick + analyze ---------- */}
        {ready && (
          <div className="flex animate-fade-in flex-col gap-4 rounded-3xl border border-line bg-card p-6 md:p-8">
            <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-[1fr_1fr_auto]">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pick-resume" className="text-[13px] font-semibold">Résumé</label>
                <select id="pick-resume" value={resumeId} onChange={(e) => setResumeId(e.target.value)} className={selectClass}>
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>{r.file_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pick-job" className="text-[13px] font-semibold">Job posting</label>
                <select id="pick-job" value={jobId} onChange={(e) => setJobId(e.target.value)} className={selectClass}>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.company ? `${j.title} · ${j.company}` : j.title}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={running}
                className="inline-flex h-[46px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-signal px-6 text-[15px] font-semibold text-white transition hover:-translate-y-px hover:shadow-[0_10px_24px_-12px_rgba(42,69,214,0.8)] disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0"
              >
                {running && <span className="h-2 w-2 animate-pulse-ring rounded-full bg-white" />}
                {running ? "Analyzing…" : "Analyze match"}
              </button>
            </div>
            {running && (
              <p role="status" className="text-[13px] text-muted">
                Reading your résumé and the job posting. This usually takes 10–30 seconds.
              </p>
            )}
            {error && (
              <p role="alert" className="rounded-xl bg-rust-soft px-4 py-3 text-sm text-rust-ink">
                {error}
              </p>
            )}
          </div>
        )}

        {/* ---------- Past results ---------- */}
        <div className="flex flex-col gap-2">
          <div className="px-1 font-mono text-[11px] tracking-[0.08em] text-muted">PAST RESULTS · {matches.length}</div>

          {matches.map((m, i) => {
            const s = scoreStyle(m.score);
            return (
              <div
                key={m.id}
                className="flex animate-fade-in flex-wrap items-center gap-4 rounded-2xl border-[1.5px] border-paper-2 bg-card px-[18px] py-3 transition hover:border-line hover:shadow-[0_10px_24px_-18px_rgba(20,22,27,0.45)]"
                style={{ animationDelay: `${i * 0.03}s` }}
              >
                <Link href={`/match/${m.id}`} className="flex min-w-0 flex-1 items-center gap-4 text-ink">
                  <span className={`flex h-[42px] w-[52px] shrink-0 items-center justify-center rounded-xl font-display text-lg font-bold ${s.soft} ${s.text}`}>
                    {m.score}
                  </span>
                  <span className="flex min-w-0 flex-col gap-[3px]">
                    <span className="truncate text-[15px] font-semibold">
                      {m.company ? `${m.job_title} · ${m.company}` : m.job_title}
                    </span>
                    <span className="truncate text-[13px] text-muted">
                      {s.label} match · {m.resume_name} · {formatDate(m.created_at)}
                      {m.is_demo ? " · DEMO" : ""}
                    </span>
                  </span>
                  <span className="ml-auto hidden text-sm font-semibold text-signal sm:inline">View →</span>
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(m)}
                  aria-label={`Delete result for ${m.job_title}`}
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] text-faint transition hover:bg-rust-soft hover:text-rust-ink"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                  </svg>
                </button>
              </div>
            );
          })}

          {matches.length === 0 && (
            <div className="rounded-[18px] border-[1.5px] border-dashed border-line p-10 text-center text-[15px] text-muted">
              No results yet. Run your first match above.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}