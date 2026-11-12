"use client";

// Tailoring Studio: every tailored version, and a one-click way to tailor a résumé for a job
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Nav from "@/components/Nav";
import { Card, EmptyState, Loading, PageHeader, StatTile, formatDate } from "@/components/ui";
import { STEP_LABEL, runPipeline, type Step } from "@/utils/pipeline";

type Report = {
  id: string;
  match_id: string;
  is_demo: boolean;
  created_at: string;
  result: { summary?: string; rewrites?: unknown[]; gaps?: string[] };
};
type MatchInfo = { id: string; resume_name: string; job_title: string; company: string | null; score: number };
type ResumeOpt = { id: string; file_name: string; label: string | null; is_default: boolean };
type JobOpt = { id: string; title: string; company: string | null };

const selectClass =
  "h-11 w-full cursor-pointer rounded-xl border-[1.5px] border-line bg-white px-3 text-[15px] focus:border-signal focus:outline-none";

export default function TailoringStudioPage() {
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
          .select("id, match_id, is_demo, created_at, result")
          .eq("kind", "tailor")
          .order("created_at", { ascending: false }),
        supabase.from("match_results").select("id, resume_name, job_title, company, score"),
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

  async function tailor() {
    if (!resumeId || !jobId) return;
    setError(null);
    try {
      const { matchId, warning } = await runPipeline(resumeId, jobId, setStep, { ats: false, tailor: true });
      if (warning) throw new Error(warning);
      const { data } = await supabase
        .from("ai_reports")
        .select("id")
        .eq("match_id", matchId)
        .eq("kind", "tailor")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      router.push(data ? `/tailor/${data.id}` : `/match/${matchId}#tailor`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tailoring failed. Please try again.");
      setStep(null);
    }
  }

  if (loading) return <Loading label="LOADING TAILORING STUDIO" />;

  const running = !!step && step !== "done";
  const totalRewrites = reports.reduce((s, r) => s + (r.result?.rewrites?.length ?? 0), 0);
  const companies = new Set(reports.map((r) => matches.get(r.match_id)?.company).filter(Boolean)).size;

  return (
    <div className="flex min-h-screen flex-col bg-paper font-body text-ink lg:flex-row">
      <Nav email={email} active="tailor" />
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-6 py-9 lg:px-10">
        <PageHeader
          title="Tailoring Studio"
          subtitle="Turn one résumé into a version made for a specific job. Review every change, keep what you like, and download it as a Word file or save it as a new version."
        />

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile label="Tailored versions" value={reports.length} />
          <StatTile label="Bullet points rewritten" value={totalRewrites} />
          <StatTile label="Companies targeted" value={companies} />
          <StatTile
            label="Average match"
            value={(() => {
              const scores = reports.map((r) => matches.get(r.match_id)?.score).filter((x): x is number => typeof x === "number");
              return scores.length ? `${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}%` : "—";
            })()}
            hint="for the jobs you tailored to"
            dark
            accent="text-mint"
          />
        </div>

        <Card title="TAILOR A RÉSUMÉ">
          {resumes.length === 0 || jobs.length === 0 ? (
            <EmptyState text="You need at least one résumé and one saved job to tailor." href={resumes.length ? "/tracker" : "/resumes"} cta={resumes.length ? "Add an application" : "Upload a résumé"} />
          ) : (
            <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                Start from this résumé
                <select value={resumeId} onChange={(e) => setResumeId(e.target.value)} className={selectClass}>
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {`${r.label || r.file_name}${r.is_default ? " · default" : ""}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                Tailor it for this job
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
                onClick={tailor}
                disabled={running}
                className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-signal px-6 text-[15px] font-semibold text-white transition hover:-translate-y-px disabled:cursor-wait disabled:opacity-70"
              >
                {running && <span className="h-2 w-2 animate-pulse-ring rounded-full bg-white" />}
                {running ? STEP_LABEL[step!] : "Tailor it"}
              </button>
            </div>
          )}
          {error && <p role="alert" className="rounded-xl bg-rust-soft px-4 py-3 text-sm text-rust-ink">{error}</p>}
        </Card>

        <Card title={`YOUR TAILORED VERSIONS · ${reports.length}`}>
          {reports.length === 0 && <EmptyState text="Nothing tailored yet. Pick a résumé and a job above." />}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {reports.map((r) => {
              const m = matches.get(r.match_id);
              return (
                <Link
                  key={r.id}
                  href={`/tailor/${r.id}`}
                  className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-paper-2 bg-paper p-4 transition hover:border-line hover:bg-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-[16px] font-semibold">{m ? m.job_title : "Job posting"}</span>
                      <span className="truncate text-[13px] text-muted">
                        {m?.company ? `${m.company} · ` : ""}from {m?.resume_name ?? "your résumé"}
                      </span>
                    </div>
                    {m && <span className="shrink-0 rounded-full bg-signal-soft px-2.5 py-1 font-mono text-[11px] font-semibold text-signal-deep">MATCH {m.score}%</span>}
                  </div>
                  {r.result?.summary && <p className="line-clamp-2 text-[13px] text-ink-2">{r.result.summary}</p>}
                  <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px] text-muted">
                    <span>{r.result?.rewrites?.length ?? 0} REWRITES</span>
                    <span>·</span>
                    <span>{r.result?.gaps?.length ?? 0} GAPS</span>
                    <span>·</span>
                    <span>{formatDate(r.created_at).toUpperCase()}</span>
                    {r.is_demo && <span>· DEMO</span>}
                    <span className="ml-auto font-body text-sm font-semibold text-signal">Open editor →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      </main>
    </div>
  );
}
