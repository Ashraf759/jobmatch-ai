"use client";

// Tailoring editor: accept or reject each change, preview the tailored résumé, then download it or save it as a new version
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Nav from "@/components/Nav";
import { Card, EmptyState, Loading, formatDate } from "@/components/ui";
import { buildTailored, makeDocx, type Rewrite, type Wording } from "@/utils/tailorDoc";
import { runHealth } from "@/utils/pipeline";

type Report = {
  id: string;
  match_id: string;
  created_at: string;
  is_demo: boolean;
  result: { summary: string; rewrites: Rewrite[]; wording: Wording[]; gaps: string[]; order_tip: string };
};
type MatchRow = { id: string; resume_id: string | null; job_title: string; company: string | null; score: number };
type ResumeRow = { id: string; file_name: string; label: string | null; resume_text: string | null };

function safe(s: string) {
  return s.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50) || "resume";
}

export default function TailorEditorPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [email, setEmail] = useState<string | undefined>();
  const [report, setReport] = useState<Report | null>(null);
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [resume, setResume] = useState<ResumeRow | null>(null);
  const [useSummary, setUseSummary] = useState(true);
  const [accepted, setAccepted] = useState<boolean[]>([]);
  const [wordingOn, setWordingOn] = useState<boolean[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"" | "reading" | "download" | "save">("");
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function loadResume(resumeId: string) {
    const { data } = await supabase.from("resumes").select("id, file_name, label, resume_text").eq("id", resumeId).maybeSingle();
    setResume((data as ResumeRow) ?? null);
    return data as ResumeRow | null;
  }

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }
      setEmail(auth.user.email);
      // Arrived from auto-tailoring: a tailored copy was already saved and downloaded
      setSavedId(new URLSearchParams(window.location.search).get("saved"));
      const { data: r } = await supabase.from("ai_reports").select("*").eq("id", id).eq("kind", "tailor").maybeSingle();
      if (!r) {
        setLoading(false);
        return;
      }
      const rep = r as Report;
      setReport(rep);
      setAccepted((rep.result.rewrites ?? []).map(() => true));
      setWordingOn((rep.result.wording ?? []).map(() => false));
      const { data: m } = await supabase
        .from("match_results")
        .select("id, resume_id, job_title, company, score")
        .eq("id", rep.match_id)
        .maybeSingle();
      setMatch((m as MatchRow) ?? null);
      if (m?.resume_id) {
        const res = await loadResume(m.resume_id);
        // Older résumés have no saved text yet: read it now (free)
        if (res && !res.resume_text) {
          setBusy("reading");
          try {
            await runHealth(res.id);
            await loadResume(res.id);
          } catch {
            // the preview will explain
          }
          setBusy("");
        }
      }
      setLoading(false);
    }
    if (id) load();
  }, [id]);

  const r = report?.result;
  const tailored = useMemo(() => {
    if (!r || !resume?.resume_text) return null;
    return buildTailored(resume.resume_text, {
      summary: useSummary ? r.summary : null,
      rewrites: (r.rewrites ?? []).filter((_, i) => accepted[i]),
      wording: (r.wording ?? []).filter((_, i) => wordingOn[i]),
    });
  }, [r, resume?.resume_text, useSummary, accepted, wordingOn]);

  const fileName = `${safe(resume?.label || resume?.file_name.replace(/\.[^.]+$/, "") || "resume")}_${safe(match?.company || match?.job_title || "job")}_tailored.docx`;

  async function download() {
    if (!tailored) return;
    setBusy("download");
    try {
      const blob = await makeDocx(tailored.lines);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError("Couldn't build the Word file. Please try again.");
    }
    setBusy("");
  }

  // Save the tailored résumé as a brand-new version in Résumés
  async function saveVersion() {
    if (!tailored || !match) return;
    setBusy("save");
    setError(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Please log in again.");
      const blob = await makeDocx(tailored.lines);
      const path = `${auth.user.id}/${Date.now()}-${fileName}`;
      const { error: upErr } = await supabase.storage.from("resumes").upload(path, blob, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      if (upErr) throw new Error(upErr.message);
      const label = `${resume?.label || "Résumé"} · ${match.company || match.job_title}`.slice(0, 60);
      const { data: row, error: insErr } = await supabase
        .from("resumes")
        .insert({ file_name: fileName, file_path: path, file_size: blob.size, label, is_default: false })
        .select("id")
        .single();
      if (insErr || !row) {
        await supabase.storage.from("resumes").remove([path]);
        throw new Error(insErr?.message ?? "Couldn't save the new version.");
      }
      await runHealth(row.id).catch(() => null);
      router.push(`/resumes/${row.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the new version.");
      setBusy("");
    }
  }

  if (loading) return <Loading label={busy === "reading" ? "READING YOUR RÉSUMÉ" : "OPENING THE EDITOR"} />;

  if (!report || !r) {
    return (
      <div className="flex min-h-screen flex-col bg-paper font-body text-ink lg:flex-row">
        <Nav email={email} active="tailor" />
        <main className="flex flex-1 flex-col gap-4 px-6 py-9 lg:px-10">
          <EmptyState text="This tailored version was not found." href="/tailor" cta="Back to Tailoring Studio" />
        </main>
      </div>
    );
  }

  const acceptedCount = accepted.filter(Boolean).length;

  return (
    <div className="flex min-h-screen flex-col bg-paper font-body text-ink lg:flex-row">
      <Nav email={email} active="tailor" />
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-6 py-9 lg:px-10">
        <Link href="/tailor" className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted hover:text-ink">
          ← Back to Tailoring Studio
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="font-mono text-xs tracking-[0.1em] text-muted">TAILORING EDITOR · {formatDate(report.created_at).toUpperCase()}</div>
            <h1 className="font-display text-[38px] font-bold leading-[1.05] tracking-[-0.04em]">
              {match?.job_title ?? "Tailored résumé"}
              {match?.company && <span className="text-muted"> · {match.company}</span>}
            </h1>
            <p className="text-[15px] text-ink-2">
              Starting from {resume?.label || resume?.file_name || "your résumé"}. Keep the changes you like, then download or save.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {match && (
              <Link href={`/match/${match.id}`} className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-line px-4 text-sm font-medium hover:border-ink">
                Match result ↗
              </Link>
            )}
            <button
              type="button"
              onClick={download}
              disabled={!tailored || !!busy}
              className="min-h-11 cursor-pointer rounded-full border-[1.5px] border-ink px-4 text-sm font-semibold transition hover:bg-ink hover:text-paper disabled:opacity-50"
            >
              {busy === "download" ? "Building…" : "Download .docx"}
            </button>
            <button
              type="button"
              onClick={saveVersion}
              disabled={!tailored || !!busy}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-signal px-5 text-sm font-semibold text-white transition hover:-translate-y-px disabled:opacity-50"
            >
              {busy === "save" && <span className="h-2 w-2 animate-pulse-ring rounded-full bg-white" />}
              {busy === "save" ? "Saving…" : "Save as new version"}
            </button>
          </div>
        </div>

        {savedId && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-green-soft px-5 py-4 text-green-ink">
            <div className="flex flex-col gap-0.5">
              <b className="text-[15px]">Your tailored résumé is ready.</b>
              <span className="text-[13px]">
                We applied every suggested change, downloaded the Word file, and saved it as a new version. Change anything below and download again if you like.
              </span>
            </div>
            <Link href={`/resumes/${savedId}`} className="rounded-full bg-green px-4 py-2 text-sm font-semibold text-white">
              Open the new version →
            </Link>
          </div>
        )}
        {error && <p role="alert" className="rounded-xl bg-rust-soft px-4 py-3 text-sm text-rust-ink">{error}</p>}
        {report.is_demo && (
          <div className="rounded-xl bg-amber-soft px-4 py-3 text-sm text-amber-ink">
            <b>Demo result.</b> Sample data, because no API key is set.
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[1fr_minmax(0,560px)]">
          {/* ---------- Changes ---------- */}
          <div className="flex min-w-0 flex-col gap-5">
            <Card
              title="SUMMARY"
              right={
                <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold">
                  <input type="checkbox" checked={useSummary} onChange={(e) => setUseSummary(e.target.checked)} className="h-4 w-4 accent-[#2A45D6]" />
                  Add to résumé
                </label>
              }
            >
              <p className={`text-[15px] leading-[1.6] ${useSummary ? "" : "text-muted line-through"}`}>{r.summary}</p>
            </Card>

            <Card title={`BULLET REWRITES · ${acceptedCount} OF ${r.rewrites?.length ?? 0} ACCEPTED`}>
              <div className="flex flex-col gap-2.5">
                {(r.rewrites ?? []).map((w, i) => (
                  <div key={i} className={`flex flex-col gap-2 rounded-2xl p-4 transition ${accepted[i] ? "bg-signal-soft/40" : "bg-paper"}`}>
                    <div className="text-[13px] text-muted line-through decoration-faint">{w.original}</div>
                    <div className="text-[15px] font-medium">{w.rewritten}</div>
                    {w.why && <div className="text-[12px] text-ink-2">{w.why}</div>}
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setAccepted((a) => a.map((v, j) => (j === i ? true : v)))}
                        className={`min-h-9 cursor-pointer rounded-full px-3 text-[13px] font-semibold ${accepted[i] ? "bg-signal text-white" : "border-[1.5px] border-line"}`}
                      >
                        {accepted[i] ? "✓ Accepted" : "Accept"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccepted((a) => a.map((v, j) => (j === i ? false : v)))}
                        className={`min-h-9 cursor-pointer rounded-full px-3 text-[13px] font-semibold ${!accepted[i] ? "bg-ink text-paper" : "border-[1.5px] border-line"}`}
                      >
                        {!accepted[i] ? "Kept original" : "Keep original"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {r.rewrites?.some((w) => w.rewritten.includes("[")) && (
                <p className="text-[13px] text-muted">Replace anything in [brackets] with your real number before you send it.</p>
              )}
            </Card>

            {(r.wording ?? []).some((w) => w.yours.length <= 30) && (
              <Card title="USE THE JOB'S WORDING">
                <div className="flex flex-col gap-2">
                  {(r.wording ?? []).map((w, i) =>
                    w.yours.length > 30 ? null : (
                      <label key={i} className="flex cursor-pointer flex-wrap items-center gap-2 text-[14px]">
                        <input
                          type="checkbox"
                          checked={!!wordingOn[i]}
                          onChange={(e) => setWordingOn((a) => a.map((v, j) => (j === i ? e.target.checked : v)))}
                          className="h-4 w-4 accent-[#2A45D6]"
                        />
                        <span className="rounded-lg bg-paper px-2 py-0.5 text-muted">{w.yours}</span>→
                        <span className="rounded-lg bg-signal-soft px-2 py-0.5 font-semibold text-signal-deep">{w.theirs}</span>
                      </label>
                    ),
                  )}
                </div>
              </Card>
            )}

            {r.gaps?.length > 0 && (
              <Card title="NOT ADDED · ONLY ADD IF TRUE">
                <ul className="flex flex-col gap-1.5 text-[14px] text-amber-ink">
                  {r.gaps.map((g) => (
                    <li key={g}>• {g}</li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          {/* ---------- Live preview ---------- */}
          <div className="min-w-0 2xl:sticky 2xl:top-9 2xl:self-start">
            <Card
              title="LIVE PREVIEW"
              right={tailored && <span className="font-mono text-[11px] text-muted">{tailored.applied} CHANGE{tailored.applied === 1 ? "" : "S"} PLACED</span>}
            >
              {!resume?.resume_text ? (
                <p className="text-sm text-muted">
                  We couldn’t read the text of this résumé, so a preview isn’t available. You can still copy each change from the match result page.
                </p>
              ) : (
                <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-white px-6 py-6 text-[13px] leading-[1.55] text-ink">
                  {tailored?.lines.map((l, i) =>
                    l.kind === "name" ? (
                      <div key={i} className="pb-1 text-center text-[20px] font-bold">{l.text}</div>
                    ) : l.kind === "heading" ? (
                      <div key={i} className="mb-1 mt-4 border-b border-line pb-0.5 text-[12px] font-bold tracking-[0.06em]">
                        {l.text.toUpperCase()}
                      </div>
                    ) : l.kind === "bullet" ? (
                      <div key={i} className={`flex gap-2 py-0.5 ${l.changed ? "rounded bg-signal-soft/60" : ""}`}>
                        <span>•</span>
                        <span>{l.text}</span>
                      </div>
                    ) : (
                      <div key={i} className={`py-0.5 ${l.changed ? "rounded bg-signal-soft/60" : ""}`}>{l.text}</div>
                    ),
                  )}
                </div>
              )}
              {tailored && tailored.missed > 0 && (
                <p className="text-[12px] text-muted">
                  {tailored.missed} accepted change{tailored.missed === 1 ? "" : "s"} couldn’t be placed automatically, usually because the PDF splits lines oddly. Copy those from the list.
                </p>
              )}
              <p className="text-[12px] text-muted">Highlighted lines are new. Formatting is simplified so ATS software can read it easily.</p>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
