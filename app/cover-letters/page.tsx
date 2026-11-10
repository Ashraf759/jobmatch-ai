"use client";

// Cover Letters: a library of every letter, with a reader/editor and a quick way to write a new one
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Nav from "@/components/Nav";
import { Card, EmptyState, Loading, PageHeader, StatTile, formatDate } from "@/components/ui";
import { runPipeline } from "@/utils/pipeline";

type Letter = { greeting: string; paragraphs: string[]; closing: string; name: string; tone: string; length: string };
type Report = { id: string; match_id: string; is_demo: boolean; created_at: string; result: Letter };
type MatchInfo = { id: string; resume_name: string; job_title: string; company: string | null };
type ResumeOpt = { id: string; file_name: string; label: string | null; is_default: boolean };
type JobOpt = { id: string; title: string; company: string | null };

const selectClass =
  "h-11 w-full cursor-pointer rounded-xl border-[1.5px] border-line bg-white px-3 text-[14px] focus:border-signal focus:outline-none";

function toText(l: Letter) {
  return [l.greeting, ...(l.paragraphs ?? []), `${l.closing}\n${l.name ?? ""}`.trim()].join("\n\n");
}

function words(s: string) {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

export default function CoverLettersPage() {
  const [email, setEmail] = useState<string | undefined>();
  const [letters, setLetters] = useState<Report[]>([]);
  const [matches, setMatches] = useState<Map<string, MatchInfo>>(new Map());
  const [resumes, setResumes] = useState<ResumeOpt[]>([]);
  const [jobs, setJobs] = useState<JobOpt[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [jobId, setJobId] = useState("");
  const [tone, setTone] = useState("professional");
  const [length, setLength] = useState("standard");
  const [writing, setWriting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  async function loadLetters(selectNewest = false) {
    const [{ data: r }, { data: m }] = await Promise.all([
      supabase
        .from("ai_reports")
        .select("id, match_id, is_demo, created_at, result")
        .eq("kind", "cover_letter")
        .order("created_at", { ascending: false }),
      supabase.from("match_results").select("id, resume_name, job_title, company"),
    ]);
    const list = (r ?? []) as Report[];
    setLetters(list);
    setMatches(new Map(((m ?? []) as MatchInfo[]).map((x) => [x.id, x])));
    if (list.length && (selectNewest || !selectedId)) {
      setSelectedId(list[0].id);
      setText(toText(list[0].result));
    }
  }

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }
      setEmail(auth.user.email);
      const [{ data: rs }, { data: js }] = await Promise.all([
        supabase
          .from("resumes")
          .select("id, file_name, label, is_default")
          .order("is_default", { ascending: false })
          .order("uploaded_at", { ascending: false }),
        supabase.from("job_postings").select("id, title, company").order("created_at", { ascending: false }),
      ]);
      const rl = (rs ?? []) as ResumeOpt[];
      const jl = (js ?? []) as JobOpt[];
      setResumes(rl);
      setJobs(jl);
      setResumeId(rl[0]?.id ?? "");
      setJobId(jl[0]?.id ?? "");
      await loadLetters();
      setLoading(false);
    }
    load();
  }, []);

  function select(r: Report) {
    setSelectedId(r.id);
    setText(toText(r.result));
    setCopied(false);
  }

  async function writeNew() {
    if (!resumeId || !jobId) return;
    setWriting(true);
    setError(null);
    try {
      const { matchId } = await runPipeline(resumeId, jobId, undefined, { ats: false, tailor: false });
      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, tone, length }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Couldn't write the letter.");
      await loadLetters(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't write the letter.");
    }
    setWriting(false);
  }

  async function remove(r: Report) {
    if (!window.confirm("Delete this cover letter?")) return;
    await supabase.from("ai_reports").delete().eq("id", r.id);
    const rest = letters.filter((l) => l.id !== r.id);
    setLetters(rest);
    if (selectedId === r.id) {
      setSelectedId(rest[0]?.id ?? null);
      setText(rest[0] ? toText(rest[0].result) : "");
    }
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

  function download(title: string) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Cover_Letter_${title.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 50)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  if (loading) return <Loading label="LOADING YOUR COVER LETTERS" />;

  const selected = letters.find((l) => l.id === selectedId) ?? null;
  const selMatch = selected ? matches.get(selected.match_id) : undefined;
  const q = query.trim().toLowerCase();
  const visible = letters.filter((l) => {
    if (!q) return true;
    const m = matches.get(l.match_id);
    return `${m?.job_title ?? ""} ${m?.company ?? ""} ${l.result?.tone ?? ""}`.toLowerCase().includes(q);
  });
  const avgWords = letters.length ? Math.round(letters.reduce((s, l) => s + words(toText(l.result)), 0) / letters.length) : 0;
  const edited = selected ? text !== toText(selected.result) : false;

  return (
    <div className="flex min-h-screen flex-col bg-paper font-body text-ink lg:flex-row">
      <Nav email={email} active="letters" />
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-6 py-9 lg:px-10">
        <PageHeader title="Cover Letters" subtitle="Every cover letter you’ve written, in one library. Open one to edit, copy or download it, or write a new one in seconds." />

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile label="Letters written" value={letters.length} />
          <StatTile label="Companies" value={new Set(letters.map((l) => matches.get(l.match_id)?.company).filter(Boolean)).size} />
          <StatTile label="Average length" value={avgWords ? `${avgWords}` : "—"} hint="words" />
          <StatTile label="Most used tone" value={mostCommon(letters.map((l) => l.result?.tone)) ?? "—"} dark accent="text-mint" />
        </div>

        <Card title="WRITE A NEW LETTER">
          {resumes.length === 0 || jobs.length === 0 ? (
            <EmptyState text="You need a résumé and a saved job first." href={resumes.length ? "/jobs" : "/resumes"} cta={resumes.length ? "Add a job" : "Upload a résumé"} />
          ) : (
            <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_150px_170px_auto]">
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                Résumé
                <select value={resumeId} onChange={(e) => setResumeId(e.target.value)} className={selectClass}>
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>{`${r.label || r.file_name}${r.is_default ? " · default" : ""}`}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                Job
                <select value={jobId} onChange={(e) => setJobId(e.target.value)} className={selectClass}>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>{j.company ? `${j.title} · ${j.company}` : j.title}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                Tone
                <select value={tone} onChange={(e) => setTone(e.target.value)} className={selectClass}>
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="confident">Confident</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                Length
                <select value={length} onChange={(e) => setLength(e.target.value)} className={selectClass}>
                  <option value="short">Short (~150 words)</option>
                  <option value="standard">Standard (~275 words)</option>
                </select>
              </label>
              <button
                type="button"
                onClick={writeNew}
                disabled={writing}
                className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-ink px-5 text-[14px] font-semibold text-paper transition hover:-translate-y-px disabled:cursor-wait disabled:opacity-70"
              >
                {writing && <span className="h-2 w-2 animate-pulse-ring rounded-full bg-paper" />}
                {writing ? "Writing…" : "Write letter"}
              </button>
            </div>
          )}
          {error && <p role="alert" className="rounded-xl bg-rust-soft px-4 py-3 text-sm text-rust-ink">{error}</p>}
        </Card>

        {letters.length === 0 ? (
          <EmptyState text="No cover letters yet. Write your first one above." />
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[340px_1fr]">
            {/* ---------- Library ---------- */}
            <div className="flex flex-col gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by job, company or tone"
                aria-label="Search cover letters"
                className="h-11 rounded-xl border-[1.5px] border-line bg-white px-3.5 text-[14px] focus:border-signal focus:outline-none"
              />
              {visible.map((l) => {
                const m = matches.get(l.match_id);
                const on = l.id === selectedId;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => select(l)}
                    className={`flex cursor-pointer flex-col gap-1 rounded-2xl border-[1.5px] p-4 text-left transition ${
                      on ? "border-signal bg-white" : "border-paper-2 bg-card hover:border-line"
                    }`}
                  >
                    <span className="truncate text-[15px] font-semibold">{m?.job_title ?? "Job posting"}</span>
                    <span className="truncate text-[13px] text-muted">{m?.company ?? "Company"}</span>
                    <span className="flex flex-wrap gap-2 pt-1 font-mono text-[10px] tracking-[0.06em] text-muted">
                      <span className="rounded-full bg-paper-2 px-2 py-0.5">{(l.result?.tone ?? "").toUpperCase()}</span>
                      <span>{words(toText(l.result))} WORDS</span>
                      <span>{formatDate(l.created_at).toUpperCase()}</span>
                    </span>
                  </button>
                );
              })}
              {visible.length === 0 && <p className="px-1 text-sm text-muted">No letters match your search.</p>}
            </div>

            {/* ---------- Reader / editor ---------- */}
            {selected && (
              <Card
                title={selMatch ? `${selMatch.job_title}${selMatch.company ? ` · ${selMatch.company}` : ""}`.toUpperCase() : "COVER LETTER"}
                right={
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/match/${selected.match_id}`} className="inline-flex min-h-9 items-center rounded-full border-[1.5px] border-line px-3 text-[13px] font-medium hover:border-ink">
                      Match result ↗
                    </Link>
                    <button type="button" onClick={() => remove(selected)} className="min-h-9 cursor-pointer rounded-full px-3 text-[13px] text-muted hover:bg-rust-soft hover:text-rust-ink">
                      Delete
                    </button>
                  </div>
                }
              >
                {selected.is_demo && <div className="rounded-xl bg-amber-soft px-4 py-3 text-sm text-amber-ink"><b>Demo result.</b> Sample text.</div>}
                <textarea
                  aria-label="Cover letter"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={18}
                  className="w-full resize-y rounded-2xl border-[1.5px] border-line bg-white p-6 text-[15px] leading-[1.7] focus:border-signal focus:outline-none"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-mono text-[12px] text-muted">
                    {words(text)} WORDS{edited ? " · EDITED (COPY OR DOWNLOAD TO KEEP YOUR EDITS)" : ""}
                  </span>
                  <div className="flex gap-2">
                    {edited && (
                      <button type="button" onClick={() => setText(toText(selected.result))} className="min-h-10 cursor-pointer rounded-full px-4 text-sm text-muted hover:bg-paper-2">
                        Undo edits
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => download(selMatch?.company || selMatch?.job_title || "job")}
                      className="min-h-10 cursor-pointer rounded-full border-[1.5px] border-line px-4 text-sm font-medium hover:border-ink"
                    >
                      Download .txt
                    </button>
                    <button type="button" onClick={copy} className="min-h-10 cursor-pointer rounded-full bg-signal px-5 text-sm font-semibold text-white">
                      {copied ? "Copied ✓" : "Copy letter"}
                    </button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function mostCommon(values: (string | undefined)[]) {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return top ? top[0].toUpperCase() + top.slice(1) : null;
}
