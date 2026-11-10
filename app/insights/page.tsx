"use client";

// Insights (SCRUM-37): patterns across ALL your applications. Computed from saved results, so it's free.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Nav from "@/components/Nav";
import { BarList, Card, EmptyState, Loading, PageHeader, Sparkline, StatTile } from "@/components/ui";

type MatchRow = {
  id: string;
  resume_id: string | null;
  resume_name: string;
  job_posting_id: string | null;
  job_title: string;
  company: string | null;
  score: number;
  created_at: string;
  result: { matched_skills?: string[]; missing_skills?: string[] };
};
type AtsRow = { score: number; result: { categories?: { key: string; label: string; points: number; max: number }[]; keywords?: { keyword: string; found: boolean; required: boolean }[] } };
type ResumeRow = { id: string; label: string | null; file_name: string; health_score: number | null };

function countSkills(lists: (string[] | undefined)[]) {
  const counts = new Map<string, { label: string; n: number }>();
  for (const list of lists)
    for (const raw of new Set((list ?? []).map((s) => s.trim()).filter(Boolean))) {
      const key = raw.toLowerCase();
      const c = counts.get(key) ?? { label: raw, n: 0 };
      c.n += 1;
      counts.set(key, c);
    }
  return [...counts.values()].sort((a, b) => b.n - a.n);
}

export default function InsightsPage() {
  const [email, setEmail] = useState<string | undefined>();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [ats, setAts] = useState<AtsRow[]>([]);
  const [resumes, setResumes] = useState<ResumeRow[]>([]);
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
      const [{ data: m }, { data: a }, { data: r }] = await Promise.all([
        supabase
          .from("match_results")
          .select("id, resume_id, resume_name, job_posting_id, job_title, company, score, created_at, result")
          .order("created_at", { ascending: true }),
        supabase.from("ai_reports").select("score, result").eq("kind", "ats"),
        supabase.from("resumes").select("id, label, file_name, health_score"),
      ]);
      setMatches((m ?? []) as MatchRow[]);
      setAts((a ?? []) as AtsRow[]);
      setResumes((r ?? []) as ResumeRow[]);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Loading label="CRUNCHING YOUR INSIGHTS" />;

  const jobsAnalyzed = new Set(matches.map((m) => m.job_posting_id).filter(Boolean)).size;
  const missing = countSkills(matches.map((m) => m.result?.missing_skills)).slice(0, 10);
  const strengths = countSkills(matches.map((m) => m.result?.matched_skills)).slice(0, 10);
  const avgMatch = matches.length ? Math.round(matches.reduce((s, m) => s + m.score, 0) / matches.length) : 0;
  const recent = matches.slice(-5);
  const earlier = matches.slice(0, Math.max(0, matches.length - 5));
  const trend =
    recent.length && earlier.length
      ? Math.round(recent.reduce((s, m) => s + m.score, 0) / recent.length - earlier.reduce((s, m) => s + m.score, 0) / earlier.length)
      : null;

  // Missing ATS keywords across every scan (required ones count double)
  const kw = new Map<string, { label: string; n: number }>();
  for (const r of ats)
    for (const k of r.result?.keywords ?? []) {
      if (k.found) continue;
      const key = k.keyword.toLowerCase();
      const c = kw.get(key) ?? { label: k.keyword, n: 0 };
      c.n += k.required ? 2 : 1;
      kw.set(key, c);
    }
  const missingKeywords = [...kw.values()].sort((a, b) => b.n - a.n).slice(0, 8);

  // Average ATS result per category
  const cat = new Map<string, { label: string; got: number; max: number }>();
  for (const r of ats)
    for (const c of r.result?.categories ?? []) {
      const t = cat.get(c.key) ?? { label: c.label, got: 0, max: 0 };
      t.got += c.points;
      t.max += c.max;
      cat.set(c.key, t);
    }
  const atsAreas = [...cat.values()].map((c) => ({ label: c.label, value: Math.round((c.got / c.max) * 100) })).sort((a, b) => a.value - b.value);

  // Which résumé version does best
  const byResume = new Map<string, { name: string; scores: number[]; wins: number }>();
  for (const m of matches) {
    const key = m.resume_id ?? m.resume_name;
    const r = resumes.find((x) => x.id === m.resume_id);
    const e = byResume.get(key) ?? { name: r?.label || m.resume_name, scores: [], wins: 0 };
    e.scores.push(m.score);
    byResume.set(key, e);
  }
  // A "win" = the best-scoring version for a job
  const bestPerJob = new Map<string, MatchRow>();
  for (const m of matches) {
    if (!m.job_posting_id) continue;
    const cur = bestPerJob.get(m.job_posting_id);
    if (!cur || m.score > cur.score) bestPerJob.set(m.job_posting_id, m);
  }
  for (const m of bestPerJob.values()) {
    const e = byResume.get(m.resume_id ?? m.resume_name);
    if (e) e.wins += 1;
  }
  const versions = [...byResume.values()]
    .map((v) => ({ ...v, avg: Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length) }))
    .sort((a, b) => b.avg - a.avg);

  const topGap = missing[0];

  return (
    <div className="flex min-h-screen flex-col bg-paper font-body text-ink lg:flex-row">
      <Nav email={email} active="insights" />
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-6 py-9 lg:px-10">
        <PageHeader
          title="Insights"
          subtitle="Patterns across every job you’ve analyzed: the skills you keep missing, your strengths, and which résumé version works best."
        />

        {matches.length === 0 ? (
          <EmptyState text="Insights appear after your first few AI Match results." href="/match" cta="Run AI Match" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatTile label="Jobs analyzed" value={jobsAnalyzed} hint={`${matches.length} matches in total`} />
              <StatTile label="Average match" value={`${avgMatch}%`} hint={trend === null ? "" : `${trend >= 0 ? "+" : ""}${trend} pts lately`} accent={trend !== null && trend >= 0 ? "text-green" : undefined} />
              <StatTile label="ATS scans" value={ats.length} hint={atsAreas[0] ? `Weakest: ${atsAreas[0].label}` : ""} />
              <StatTile label="#1 skill to learn" value={topGap ? topGap.label : "—"} hint={topGap ? `Missing in ${topGap.n} of ${matches.length} matches` : ""} dark accent="text-mint" />
            </div>

            {topGap && (
              <div className="flex flex-col gap-2 rounded-3xl bg-ink bg-dots p-7 text-paper">
                <div className="font-mono text-[11px] tracking-[0.1em] text-signal-glow">RECOMMENDATION</div>
                <p className="font-display text-[24px] font-bold leading-[1.2] tracking-[-0.02em]">
                  {topGap.label} is missing from {Math.round((topGap.n / matches.length) * 100)}% of the jobs you looked at.
                  {missing[1] ? ` ${missing[1].label} is next.` : ""}
                </p>
                <p className="text-[14px] text-fog">
                  Learning these, or adding them to your résumé if you already have them, would raise your match score on the most jobs.
                  {versions[0] && versions.length > 1 ? ` Your best version so far is “${versions[0].name}”.` : ""}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <Card title="SKILLS YOU KEEP MISSING">
                {missing.length ? <BarList items={missing.map((m) => ({ label: m.label, value: m.n }))} suffix=" jobs" color="bg-amber" /> : <p className="text-sm text-muted">No gaps found yet.</p>}
              </Card>
              <Card title="YOUR STRONGEST SKILLS">
                {strengths.length ? <BarList items={strengths.map((m) => ({ label: m.label, value: m.n }))} suffix=" jobs" color="bg-green" /> : <p className="text-sm text-muted">No data yet.</p>}
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
              <Card title="WHICH RÉSUMÉ VERSION WINS">
                <div className="flex flex-col gap-2">
                  {versions.map((v, i) => (
                    <div key={v.name + i} className="flex items-center gap-3 rounded-2xl bg-paper px-4 py-3">
                      <span className="font-mono text-[12px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{v.name}</span>
                      <span className="font-mono text-[12px] text-muted">{v.scores.length} JOBS</span>
                      <span className="font-mono text-[12px] text-green-ink">{v.wins} WINS</span>
                      <span className="w-14 rounded-full bg-signal-soft px-2 py-1 text-center font-mono text-[12px] font-semibold text-signal-deep">{v.avg}%</span>
                    </div>
                  ))}
                </div>
                <p className="text-[12px] text-muted">A win means this version had the highest score for a job.</p>
              </Card>
              <Card title="ATS: WHERE YOU LOSE POINTS">
                {atsAreas.length ? (
                  <BarList items={atsAreas.map((a) => ({ label: a.label, value: a.value }))} max={100} suffix="%" color="bg-signal" />
                ) : (
                  <p className="text-sm text-muted">
                    Run an <Link href="/ats" className="text-signal underline">ATS scan</Link> to see this.
                  </p>
                )}
                {missingKeywords.length > 0 && (
                  <div className="flex flex-col gap-2 pt-2">
                    <div className="text-[13px] font-semibold">Keywords ATS software couldn’t find most often</div>
                    <div className="flex flex-wrap gap-1.5">
                      {missingKeywords.map((k) => (
                        <span key={k.label} className="rounded-lg bg-amber-soft px-2.5 py-1 text-[13px] text-amber-ink">
                          {k.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>

            <Card title="MATCH SCORE OVER TIME">
              <Sparkline values={matches.map((m) => m.score)} width={600} height={90} />
              <p className="text-[13px] text-muted">Every AI Match result, oldest to newest.</p>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
