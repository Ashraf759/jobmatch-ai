"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Nav from "@/components/Nav";
import AtsCard from "@/components/AtsCard";

type MatchDetails = {
  summary: string;
  matched_skills: string[];
  missing_skills: string[];
  suggestions: string[];
};

type MatchRow = {
  id: string;
  resume_id: string | null;
  job_posting_id: string | null;
  resume_name: string;
  job_title: string;
  company: string | null;
  score: number;
  result: MatchDetails;
  is_demo: boolean;
  completed_suggestions: number[] | null;
  created_at: string;
};

const RING = 326.7;

function scoreStyle(score: number) {
  if (score >= 85)
    return {
      label: "Strong match",
      meaning: "You meet most of what this job asks for. Polish the details and apply.",
      text: "text-green-ink",
      soft: "bg-green-soft",
      ring: "#7FD1B0",
    };
  if (score >= 70)
    return {
      label: "Good match",
      meaning: "You’re a solid fit. A few targeted edits could make your résumé stronger.",
      text: "text-signal-deep",
      soft: "bg-signal-soft",
      ring: "#7C93FF",
    };
  if (score >= 50)
    return {
      label: "Partial match",
      meaning: "You match some key requirements. Close the gaps below before you apply.",
      text: "text-amber-ink",
      soft: "bg-amber-soft",
      ring: "#F0A93B",
    };
  return {
    label: "Weak match",
    meaning: "This role asks for a lot your résumé doesn’t show yet. Treat it as a stretch, or build up the missing skills first.",
    text: "text-rust-ink",
    soft: "bg-rust-soft",
    ring: "#E07A66",
  };
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function MatchResultPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [row, setRow] = useState<MatchRow | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [email, setEmail] = useState<string | undefined>();
  const [done, setDone] = useState<number[]>([]);
  const [ringOn, setRingOn] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

      // RLS makes sure this only finds the user's own result
      const { data } = await supabase.from("match_results").select("*").eq("id", id).maybeSingle();
      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const match = data as MatchRow;
      setRow(match);
      setDone(match.completed_suggestions ?? []);

      if (match.job_posting_id) {
        const { data: job } = await supabase
          .from("job_postings")
          .select("source_url")
          .eq("id", match.job_posting_id)
          .maybeSingle();
        setSourceUrl(job?.source_url ?? null);
      }
      setLoading(false);
    }
    if (id) load();
  }, [id]);

  // Animate the score ring once the result has loaded
  useEffect(() => {
    if (!row) return;
    setRingOn(false);
    const t = setTimeout(() => setRingOn(true), 80);
    return () => clearTimeout(t);
  }, [row?.id]);

  async function toggleSuggestion(index: number) {
    if (!row) return;
    const before = done;
    const next = done.includes(index) ? done.filter((n) => n !== index) : [...done, index].sort((a, b) => a - b);
    setDone(next); // update the screen right away

    const { error } = await supabase
      .from("match_results")
      .update({ completed_suggestions: next })
      .eq("id", row.id);

    if (error) {
      setDone(before); // put it back if saving failed
      setError("We couldn’t save that change. Please try again.");
    }
  }

  async function handleRunAgain() {
    if (!row?.resume_id || !row?.job_posting_id) return;
    setError(null);
    setRerunning(true);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId: row.resume_id, jobId: row.job_posting_id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Something went wrong. Please try again.");
        setRerunning(false);
        return;
      }
      router.push(`/match/${json.match.id}`);
    } catch {
      setError("We couldn’t reach the server. Check your connection and try again.");
      setRerunning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="flex items-center gap-3 font-mono text-sm tracking-[0.08em] text-muted">
          <span className="h-2 w-2 animate-pulse-ring rounded-full bg-signal" />
          LOADING YOUR RESULTS
        </div>
      </div>
    );
  }

  if (notFound || !row) {
    return (
      <div className="flex min-h-screen flex-col bg-paper font-body text-ink lg:flex-row">
        <Nav email={email} active="match" />
        <main className="flex flex-1 flex-col items-start gap-4 px-6 py-9 lg:px-10">
          <h1 className="font-display text-[40px] font-bold leading-none tracking-[-0.04em]">Result not found</h1>
          <p className="text-[16px] text-ink-2">This analysis may have been deleted.</p>
          <Link href="/match" className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper">
            Back to AI Match
          </Link>
        </main>
      </div>
    );
  }

  const style = scoreStyle(row.score);
  const matched = row.result.matched_skills ?? [];
  const missing = row.result.missing_skills ?? [];
  const suggestions = row.result.suggestions ?? [];
  const totalSkills = matched.length + missing.length;
  const coverage = totalSkills ? Math.round((matched.length / totalSkills) * 100) : 0;
  const doneCount = done.filter((n) => n < suggestions.length).length;
  const canRerun = Boolean(row.resume_id && row.job_posting_id);

  return (
    <div className="flex min-h-screen flex-col bg-paper font-body text-ink lg:flex-row print:bg-white">
      <div className="contents print:hidden">
        <Nav email={email} active="match" />
      </div>

      <main className="flex min-w-0 flex-1 flex-col gap-7 px-6 py-9 lg:px-10">
        {/* ---------- Header ---------- */}
        <div className="flex flex-col gap-4">
          <Link href="/match" className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted hover:text-ink print:hidden">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            Back to AI Match
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="font-mono text-xs tracking-[0.1em] text-muted">ANALYZED {formatDate(row.created_at).toUpperCase()}</div>
              <h1 className="font-display text-[40px] font-bold leading-[1.05] tracking-[-0.04em]">
                {row.job_title}
                {row.company && <span className="text-muted"> · {row.company}</span>}
              </h1>
              <p className="text-[15px] text-ink-2">Compared with {row.resume_name}</p>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-line px-4 text-sm font-medium text-ink transition hover:border-ink"
                >
                  Job posting ↗
                </a>
              )}
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-11 cursor-pointer rounded-full border-[1.5px] border-line px-4 text-sm font-medium transition hover:border-ink"
              >
                Print / Save PDF
              </button>
              <button
                type="button"
                onClick={handleRunAgain}
                disabled={!canRerun || rerunning}
                title={canRerun ? "Analyze again, for example after updating your résumé" : "The résumé or job posting was deleted"}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-signal px-5 text-sm font-semibold text-white transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {rerunning && <span className="h-2 w-2 animate-pulse-ring rounded-full bg-white" />}
                {rerunning ? "Analyzing…" : "Run again"}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-rust-soft px-4 py-3 text-sm text-rust-ink print:hidden">
            {error}
          </p>
        )}

        {row.is_demo && (
          <div className="rounded-xl bg-amber-soft px-4 py-3 text-sm text-amber-ink">
            <b>Demo result.</b> This is sample data, because no Claude API key is set yet.
          </div>
        )}

        {/* ---------- Score + summary ---------- */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
          <section
            aria-label="Match score"
            className="flex animate-fade-in flex-col items-center gap-4 rounded-3xl bg-ink bg-dots p-8 text-center text-paper print:border print:border-line print:bg-white print:text-ink"
          >
            <div className="relative flex h-[190px] w-[190px] items-center justify-center">
              <svg width="190" height="190" viewBox="0 0 120 120" aria-hidden="true" className="absolute -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#2E323C" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke={style.ring}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={RING}
                  strokeDashoffset={ringOn ? RING * (1 - row.score / 100) : RING}
                  style={{ transition: "stroke-dashoffset 1.3s cubic-bezier(0.2,0.7,0.2,1)" }}
                />
              </svg>
              <div className="flex flex-col items-center">
                <div className="font-display text-[58px] font-bold leading-none tracking-[-0.04em]">
                  {row.score}
                  <span className="text-2xl text-mist">%</span>
                </div>
                <div className="font-mono text-[10px] tracking-[0.12em] text-mist">MATCH SCORE</div>
              </div>
            </div>
            <span className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${style.soft} ${style.text}`}>{style.label}</span>
            <p className="text-[14px] leading-[1.55] text-fog print:text-ink-2">{style.meaning}</p>
          </section>

          <div className="flex min-w-0 flex-col gap-5">
            <section aria-label="Summary" className="flex animate-fade-in flex-col gap-2 rounded-3xl border border-line bg-card p-6 md:p-8">
              <div className="font-mono text-[11px] tracking-[0.1em] text-muted">SUMMARY</div>
              <p className="text-[16px] leading-[1.6]">{row.result.summary}</p>
            </section>

            {/* ---------- Skills gap ---------- */}
            <section aria-label="Skills gap" className="flex animate-fade-in flex-col gap-5 rounded-3xl border border-line bg-card p-6 md:p-8">
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div className="font-mono text-[11px] tracking-[0.1em] text-muted">SKILLS GAP</div>
                  <div className="text-sm text-ink-2">
                    <b className="text-ink">{matched.length}</b> of {totalSkills} skills found · {coverage}% coverage
                  </div>
                </div>
                <div className="flex h-3 overflow-hidden rounded-full bg-amber-soft">
                  <div
                    className="h-3 rounded-full bg-signal transition-[width] duration-1000"
                    style={{ width: ringOn ? `${coverage}%` : "0%" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="flex flex-col gap-2.5 rounded-2xl bg-signal-soft/50 p-4">
                  <div className="text-sm font-semibold text-signal-deep">You have · {matched.length}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {matched.length === 0 && <span className="text-sm text-muted">None found</span>}
                    {matched.map((s) => (
                      <span key={s} className="rounded-lg bg-card px-2.5 py-1.5 text-[13px] text-signal-deep">✓ {s}</span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2.5 rounded-2xl bg-amber-soft/60 p-4">
                  <div className="text-sm font-semibold text-amber-ink">You’re missing · {missing.length}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {missing.length === 0 && <span className="text-sm text-muted">Nothing, nice!</span>}
                    {missing.map((s) => (
                      <span key={s} className="rounded-lg bg-card px-2.5 py-1.5 text-[13px] text-amber-ink">+ {s}</span>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* ---------- ATS check (SCRUM-32) ---------- */}
        <AtsCard matchId={row.id} canRun={canRerun} />

        {/* ---------- Suggestions checklist ---------- */}
        <section aria-label="Suggestions" className="flex animate-fade-in flex-col gap-4 rounded-3xl border border-line bg-card p-6 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex flex-col gap-1">
              <div className="font-mono text-[11px] tracking-[0.1em] text-muted">SUGGESTIONS</div>
              <p className="text-sm text-ink-2">Tick each one off as you update your résumé.</p>
            </div>
            <div className="text-sm font-semibold">
              {doneCount} of {suggestions.length} done
            </div>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-paper-2">
            <div
              className="h-1.5 rounded-full bg-green transition-[width] duration-500"
              style={{ width: suggestions.length ? `${(doneCount / suggestions.length) * 100}%` : "0%" }}
            />
          </div>
          <ul className="flex flex-col gap-2">
            {suggestions.map((s, i) => {
              const checked = done.includes(i);
              return (
                <li key={i}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggleSuggestion(i)}
                    className={`flex w-full cursor-pointer items-start gap-3 rounded-[14px] p-3.5 text-left text-[15px] leading-normal transition ${
                      checked ? "bg-green-soft/60" : "bg-paper hover:bg-paper-2"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-[1.5px] transition ${
                        checked ? "border-green bg-green text-white" : "border-line bg-white"
                      }`}
                      aria-hidden="true"
                    >
                      {checked && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </span>
                    <span className={checked ? "text-muted line-through" : ""}>{s}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}
