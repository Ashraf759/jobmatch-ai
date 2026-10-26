"use client";

// SCRUM-34 (stretch): cover letter generator, shown on a match result page
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Letter = {
  greeting: string;
  paragraphs: string[];
  closing: string;
  name: string;
  tone: string;
  length: string;
};
type LetterReport = { id: string; is_demo: boolean; created_at: string; result: Letter };

const selectClass =
  "h-11 cursor-pointer rounded-xl border-[1.5px] border-line bg-white px-3 text-[14px] text-ink transition focus:border-signal focus:shadow-[0_0_0_4px_rgba(42,69,214,0.15)] focus:outline-none";

function toText(l: Letter) {
  return [l.greeting, ...l.paragraphs, `${l.closing}\n${l.name}`.trim()].join("\n\n");
}

function fileSafe(s: string) {
  return s.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "job";
}

export default function CoverLetterCard({
  matchId,
  canRun,
  jobTitle,
}: {
  matchId: string;
  canRun: boolean;
  jobTitle: string;
}) {
  const [report, setReport] = useState<LetterReport | null>(null);
  const [text, setText] = useState("");
  const [tone, setTone] = useState("professional");
  const [length, setLength] = useState("standard");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  function show(r: LetterReport) {
    setReport(r);
    setText(toText(r.result));
    if (r.result.tone) setTone(r.result.tone);
    if (r.result.length) setLength(r.result.length);
  }

  // Load the most recent cover letter for this match, if there is one
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("ai_reports")
        .select("id, is_demo, created_at, result")
        .eq("match_id", matchId)
        .eq("kind", "cover_letter")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) show(data as LetterReport);
      setLoading(false);
    }
    load();
  }, [matchId]);

  async function generate() {
    if (report && text !== toText(report.result) && !window.confirm("Write a new draft? Your edits to this one will be replaced.")) {
      return;
    }
    setError(null);
    setRunning(true);
    try {
      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, tone, length }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setError(json.error ?? "Something went wrong. Please try again.");
      else show(json.report as LetterReport);
    } catch {
      setError("We couldn’t reach the server. Check your connection and try again.");
    }
    setRunning(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn’t copy. Select the text and copy it yourself.");
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `Cover_Letter_${fileSafe(jobTitle)}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const edited = Boolean(report && text !== toText(report.result));

  return (
    <section aria-label="Cover letter" className="flex animate-fade-in flex-col gap-5 rounded-3xl border border-line bg-card p-6 md:p-8">
      {/* ---------- Header + options ---------- */}
      <div className="flex flex-col gap-1">
        <div className="font-mono text-[11px] tracking-[0.1em] text-muted">COVER LETTER</div>
        <p className="max-w-[620px] text-sm text-ink-2">
          Get a first draft built from your real résumé and this job. Edit it here, then copy or download it.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cl-tone" className="text-[13px] font-semibold">Tone</label>
          <select id="cl-tone" value={tone} onChange={(e) => setTone(e.target.value)} className={selectClass}>
            <option value="professional">Professional</option>
            <option value="friendly">Friendly</option>
            <option value="confident">Confident</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cl-length" className="text-[13px] font-semibold">Length</label>
          <select id="cl-length" value={length} onChange={(e) => setLength(e.target.value)} className={selectClass}>
            <option value="short">Short (~150 words)</option>
            <option value="standard">Standard (~275 words)</option>
          </select>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={!canRun || running || loading}
          title={canRun ? undefined : "The résumé or job posting was deleted"}
          className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-paper transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {running && <span className="h-2 w-2 animate-pulse-ring rounded-full bg-paper" />}
          {running ? "Writing…" : report ? "Write a new draft" : "Write cover letter"}
        </button>
      </div>

      {running && (
        <p role="status" className="text-[13px] text-muted">
          Writing your draft. This usually takes 10–30 seconds.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-rust-soft px-4 py-3 text-sm text-rust-ink">
          {error}
        </p>
      )}

      {/* ---------- Draft ---------- */}
      {report && (
        <>
          {report.is_demo && (
            <div className="rounded-xl bg-amber-soft px-4 py-3 text-sm text-amber-ink">
              <b>Demo result.</b> This is sample text, because no Claude API key is set yet.
            </div>
          )}

          <textarea
            aria-label="Cover letter draft"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={16}
            className="w-full resize-y rounded-2xl border-[1.5px] border-line bg-white p-5 text-[15px] leading-[1.7] text-ink transition focus:border-signal focus:shadow-[0_0_0_4px_rgba(42,69,214,0.15)] focus:outline-none md:p-7 print:border-0 print:p-0"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="font-mono text-[12px] text-muted">
              {words} WORDS{edited ? " · EDITED (EDITS AREN’T SAVED, SO COPY OR DOWNLOAD)" : ""}
            </div>
            <div className="flex gap-2">
              {edited && report && (
                <button
                  type="button"
                  onClick={() => setText(toText(report.result))}
                  className="min-h-10 cursor-pointer rounded-full px-4 text-sm font-medium text-muted transition hover:bg-paper-2 hover:text-ink"
                >
                  Undo edits
                </button>
              )}
              <button
                type="button"
                onClick={download}
                className="min-h-10 cursor-pointer rounded-full border-[1.5px] border-line px-4 text-sm font-medium transition hover:border-ink"
              >
                Download .txt
              </button>
              <button
                type="button"
                onClick={copy}
                className="min-h-10 cursor-pointer rounded-full bg-signal px-5 text-sm font-semibold text-white transition hover:-translate-y-px"
              >
                {copied ? "Copied ✓" : "Copy letter"}
              </button>
            </div>
          </div>

          <p className="text-[12px] text-muted">
            Read it through before you send it. Make sure every claim is true and it sounds like you.
          </p>
        </>
      )}
    </section>
  );
}
