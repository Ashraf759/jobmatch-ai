"use client";

// SCRUM-32: ATS compatibility check, shown on a match result page
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Category = { key: string; label: string; points: number; max: number; note: string };
type Keyword = { keyword: string; required: boolean; found: boolean };
type AtsReport = {
  id: string;
  score: number;
  is_demo: boolean;
  created_at: string;
  result: {
    summary: string;
    categories: Category[];
    keywords: Keyword[];
    layout_risks: string[];
    fixes: string[];
    file_type: "pdf" | "docx";
  };
};

function atsStyle(score: number) {
  if (score >= 80) return { label: "ATS friendly", text: "text-green-ink", soft: "bg-green-soft" };
  if (score >= 60) return { label: "Mostly readable", text: "text-amber-ink", soft: "bg-amber-soft" };
  return { label: "Needs work", text: "text-rust-ink", soft: "bg-rust-soft" };
}

function barColor(points: number, max: number) {
  const ratio = max ? points / max : 0;
  if (ratio >= 0.8) return "bg-green";
  if (ratio >= 0.5) return "bg-amber";
  return "bg-rust";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AtsCard({ matchId, canRun }: { matchId: string; canRun: boolean }) {
  const [report, setReport] = useState<AtsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [barsOn, setBarsOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  // Load the most recent ATS check for this match, if there is one
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("ai_reports")
        .select("id, score, is_demo, created_at, result")
        .eq("match_id", matchId)
        .eq("kind", "ats")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setReport((data as AtsReport) ?? null);
      setLoading(false);
    }
    load();
  }, [matchId]);

  // Animate the bars whenever a new report appears
  useEffect(() => {
    if (!report) return;
    setBarsOn(false);
    const t = setTimeout(() => setBarsOn(true), 80);
    return () => clearTimeout(t);
  }, [report?.id]);

  async function runCheck() {
    setError(null);
    setRunning(true);
    try {
      const res = await fetch("/api/ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setError(json.error ?? "Something went wrong. Please try again.");
      else setReport(json.report as AtsReport);
    } catch {
      setError("We couldn’t reach the server. Check your connection and try again.");
    }
    setRunning(false);
  }

  const style = report ? atsStyle(report.score) : null;
  const keywords = report?.result.keywords ?? [];
  const found = keywords.filter((k) => k.found);
  const missing = keywords.filter((k) => !k.found);

  return (
    <section aria-label="ATS check" className="flex animate-fade-in flex-col gap-5 rounded-3xl border border-line bg-card p-6 md:p-8">
      {/* ---------- Header ---------- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="font-mono text-[11px] tracking-[0.1em] text-muted">ATS CHECK</div>
          <p className="max-w-[560px] text-sm text-ink-2">
            Many companies use applicant tracking systems (ATS) to scan résumés before a person reads them. This checks how easily that
            software can read yours and find this job’s keywords.
          </p>
        </div>
        <button
          type="button"
          onClick={runCheck}
          disabled={!canRun || running || loading}
          title={canRun ? undefined : "The résumé or job posting was deleted"}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-paper transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 print:hidden"
        >
          {running && <span className="h-2 w-2 animate-pulse-ring rounded-full bg-paper" />}
          {running ? "Checking…" : report ? "Check again" : "Run ATS check"}
        </button>
      </div>

      {running && (
        <p role="status" className="text-[13px] text-muted">
          Reading your résumé the way ATS software would. This usually takes 10–30 seconds.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-rust-soft px-4 py-3 text-sm text-rust-ink">
          {error}
        </p>
      )}

      {/* ---------- Not run yet ---------- */}
      {!loading && !report && !running && (
        <div className="grid grid-cols-1 gap-2 text-[14px] text-ink-2 sm:grid-cols-2 lg:grid-cols-5">
          {["Job keywords", "Standard sections", "ATS-safe formatting", "Contact info", "Length"].map((label) => (
            <div key={label} className="rounded-2xl bg-paper px-4 py-3">
              <span className="text-green">✓</span> {label}
            </div>
          ))}
        </div>
      )}

      {/* ---------- Result ---------- */}
      {report && style && (
        <>
          {report.is_demo && (
            <div className="rounded-xl bg-amber-soft px-4 py-3 text-sm text-amber-ink">
              <b>Demo result.</b> This is sample data, because no Claude API key is set yet.
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_1fr]">
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-paper p-6 text-center">
              <div className="font-display text-[64px] font-bold leading-none tracking-[-0.04em]">
                {report.score}
                <span className="text-2xl text-muted">/100</span>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${style.soft} ${style.text}`}>{style.label}</span>
              <div className="font-mono text-[10px] tracking-[0.1em] text-muted">CHECKED {formatDate(report.created_at).toUpperCase()}</div>
            </div>

            <div className="flex flex-col gap-3.5">
              {report.result.summary && <p className="text-[15px] leading-[1.6]">{report.result.summary}</p>}
              {report.result.categories.map((c) => (
                <div key={c.key} className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span className="font-semibold">{c.label}</span>
                    <span className="font-mono text-[12px] text-muted">
                      {c.points}/{c.max}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-paper-2">
                    <div
                      className={`h-2 rounded-full transition-[width] duration-1000 ${barColor(c.points, c.max)}`}
                      style={{ width: barsOn ? `${(c.points / c.max) * 100}%` : "0%" }}
                    />
                  </div>
                  <span className="text-[13px] text-muted">{c.note}</span>
                </div>
              ))}
            </div>
          </div>

          {keywords.length > 0 && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="flex flex-col gap-2.5 rounded-2xl bg-green-soft/50 p-4">
                <div className="text-sm font-semibold text-green-ink">Keywords found · {found.length}</div>
                <div className="flex flex-wrap gap-1.5">
                  {found.length === 0 && <span className="text-sm text-muted">None yet</span>}
                  {found.map((k) => (
                    <span key={k.keyword} className="rounded-lg bg-card px-2.5 py-1.5 text-[13px] text-green-ink">
                      ✓ {k.keyword}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2.5 rounded-2xl bg-amber-soft/60 p-4">
                <div className="text-sm font-semibold text-amber-ink">Keywords missing · {missing.length}</div>
                <div className="flex flex-wrap gap-1.5">
                  {missing.length === 0 && <span className="text-sm text-muted">Nothing, nice!</span>}
                  {missing.map((k) => (
                    <span key={k.keyword} className="rounded-lg bg-card px-2.5 py-1.5 text-[13px] text-amber-ink">
                      + {k.keyword}
                      {k.required && <span className="ml-1.5 font-mono text-[10px] tracking-[0.06em] text-rust-ink">REQUIRED</span>}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {report.result.fixes.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="font-mono text-[11px] tracking-[0.1em] text-muted">QUICK FIXES</div>
              <ul className="flex flex-col gap-2">
                {report.result.fixes.map((fix, i) => (
                  <li key={i} className="flex gap-3 rounded-[14px] bg-paper p-3.5 text-[15px] leading-normal">
                    <span className="font-mono text-[13px] font-semibold text-signal">{String(i + 1).padStart(2, "0")}</span>
                    {fix}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[12px] text-muted">
            Only add keywords for skills you really have. Real ATS systems differ, so treat this score as a guide, not a guarantee.
          </p>
        </>
      )}
    </section>
  );
}
