"use client";

// SCRUM-31: AI résumé tailoring suggestions, shown on a match result page
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Rewrite = { original: string; rewritten: string; why: string };
type TailorReport = {
  id: string;
  is_demo: boolean;
  created_at: string;
  result: {
    summary: string;
    rewrites: Rewrite[];
    wording: { yours: string; theirs: string }[];
    gaps: string[];
    order_tip: string;
  };
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked: nothing else to do
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="min-h-9 shrink-0 cursor-pointer rounded-full border-[1.5px] border-line px-3 text-[13px] font-medium transition hover:border-ink print:hidden"
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

export default function TailorCard({ matchId, canRun }: { matchId: string; canRun: boolean }) {
  const [report, setReport] = useState<TailorReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  // Load the most recent tailoring for this match, if there is one
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("ai_reports")
        .select("id, is_demo, created_at, result")
        .eq("match_id", matchId)
        .eq("kind", "tailor")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setReport((data as TailorReport) ?? null);
      setLoading(false);
    }
    load();
  }, [matchId]);

  async function runTailor() {
    setError(null);
    setRunning(true);
    try {
      const res = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setError(json.error ?? "Something went wrong. Please try again.");
      else setReport(json.report as TailorReport);
    } catch {
      setError("We couldn’t reach the server. Check your connection and try again.");
    }
    setRunning(false);
  }

  const r = report?.result;

  return (
    <section aria-label="Tailor my résumé" className="flex animate-fade-in flex-col gap-5 rounded-3xl border border-line bg-card p-6 md:p-8">
      {/* ---------- Header ---------- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="font-mono text-[11px] tracking-[0.1em] text-muted">TAILOR MY RÉSUMÉ</div>
          <p className="max-w-[560px] text-sm text-ink-2">
            Get honest rewrites of your own bullet points, aimed at this job. Nothing is invented. Copy what you like into your résumé.
          </p>
        </div>
        <button
          type="button"
          onClick={runTailor}
          disabled={!canRun || running || loading}
          title={canRun ? undefined : "The résumé or job posting was deleted"}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-signal px-5 text-sm font-semibold text-white transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 print:hidden"
        >
          {running && <span className="h-2 w-2 animate-pulse-ring rounded-full bg-white" />}
          {running ? "Tailoring…" : report ? "Tailor again" : "Tailor for this job"}
        </button>
      </div>

      {running && (
        <p role="status" className="text-[13px] text-muted">
          Reading your résumé and rewriting it for this job. This usually takes 15–40 seconds.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-rust-soft px-4 py-3 text-sm text-rust-ink">
          {error}
        </p>
      )}

      {report && r && (
        <>
          {report.is_demo && (
            <div className="rounded-xl bg-amber-soft px-4 py-3 text-sm text-amber-ink">
              <b>Demo result.</b> This is sample data, because no Claude API key is set yet.
            </div>
          )}

          {/* ---------- Summary ---------- */}
          {r.summary && (
            <div className="flex flex-col gap-3 rounded-2xl bg-ink bg-dots p-5 text-paper md:p-6 print:border print:border-line print:bg-white print:text-ink">
              <div className="flex items-center justify-between gap-3">
                <div className="font-mono text-[11px] tracking-[0.1em] text-signal-glow print:text-muted">SUGGESTED SUMMARY</div>
                <CopyButton text={r.summary} />
              </div>
              <p className="text-[16px] leading-[1.6]">{r.summary}</p>
            </div>
          )}

          {/* ---------- Bullet rewrites ---------- */}
          {r.rewrites.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <div className="font-mono text-[11px] tracking-[0.1em] text-muted">BULLET REWRITES · {r.rewrites.length}</div>
              {r.rewrites.map((w, i) => (
                <div key={i} className="flex flex-col gap-2.5 rounded-2xl bg-paper p-4">
                  <div className="flex gap-3 text-[14px] text-muted">
                    <span className="w-12 shrink-0 font-mono text-[10px] tracking-[0.08em] leading-6">BEFORE</span>
                    <span className="line-through decoration-faint">{w.original}</span>
                  </div>
                  <div className="flex items-start gap-3 text-[15px]">
                    <span className="w-12 shrink-0 font-mono text-[10px] font-semibold tracking-[0.08em] leading-6 text-signal">AFTER</span>
                    <span className="flex-1 font-medium">{w.rewritten}</span>
                    <CopyButton text={w.rewritten} />
                  </div>
                  {w.why && <div className="pl-[60px] text-[13px] text-ink-2">{w.why}</div>}
                </div>
              ))}
              {r.rewrites.some((w) => w.rewritten.includes("[")) && (
                <p className="text-[13px] text-muted">
                  Replace anything in [brackets] with your real number before you use it.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* ---------- Use their wording ---------- */}
            <div className="flex flex-col gap-2.5 rounded-2xl bg-signal-soft/50 p-4">
              <div className="text-sm font-semibold text-signal-deep">Use the job’s wording</div>
              {r.wording.length === 0 && <span className="text-sm text-muted">Your wording already matches.</span>}
              <div className="flex flex-col gap-1.5">
                {r.wording.map((w) => (
                  <div key={w.yours + w.theirs} className="flex flex-wrap items-center gap-2 text-[14px]">
                    <span className="rounded-lg bg-card px-2.5 py-1 text-muted">{w.yours}</span>
                    <span aria-hidden="true" className="text-signal">→</span>
                    <span className="rounded-lg bg-card px-2.5 py-1 font-semibold text-signal-deep">{w.theirs}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ---------- Honest gaps ---------- */}
            <div className="flex flex-col gap-2.5 rounded-2xl bg-amber-soft/60 p-4">
              <div className="text-sm font-semibold text-amber-ink">Don’t add these unless they’re true</div>
              {r.gaps.length === 0 && <span className="text-sm text-muted">No gaps found.</span>}
              <div className="flex flex-wrap gap-1.5">
                {r.gaps.map((g) => (
                  <span key={g} className="rounded-lg bg-card px-2.5 py-1.5 text-[13px] text-amber-ink">
                    {g}
                  </span>
                ))}
              </div>
              {r.gaps.length > 0 && (
                <p className="text-[13px] text-ink-2">The job asks for these, but your résumé doesn’t show them. Learn them, or mention them only if you’ve used them.</p>
              )}
            </div>
          </div>

          {r.order_tip && (
            <p className="rounded-xl bg-paper px-4 py-3 text-[14px] text-ink-2">
              <b className="text-ink">Order tip:</b> {r.order_tip}
            </p>
          )}

          <div className="font-mono text-[10px] tracking-[0.1em] text-muted">TAILORED {formatDate(report.created_at).toUpperCase()}</div>
        </>
      )}
    </section>
  );
}
