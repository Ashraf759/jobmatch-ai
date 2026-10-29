// Shared helpers for the Sprint 3 AI features (ATS check, résumé tailoring, cover letter).
// Each feature starts from an existing AI Match result, so it reuses that résumé + job.
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/utils/supabase/server";

export type Supa = Awaited<ReturnType<typeof createClient>>;
export type ReportKind = "ats" | "tailor" | "cover_letter";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
export const DAILY_LIMIT = 20; // real (non-demo) runs per feature, per user, per 24 hours
const MAX_JOB_CHARS = 20_000;
const MAX_RESUME_CHARS = 30_000;

export const isDemo = () => !process.env.ANTHROPIC_API_KEY;

export function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// Keep only non-empty strings, trimmed and capped
export function cleanList(value: unknown, max: number, maxLength = 400) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, max);
}

export function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

// Read { matchId } from the request body
export async function readMatchId(request: Request) {
  try {
    const body = await request.json();
    return typeof body?.matchId === "string" ? body.matchId : "";
  } catch {
    return "";
  }
}

type Resume = { id: string; file_name: string; file_path: string };
type Job = { id: string; title: string; company: string | null; description: string };
type Match = { id: string; resume_id: string | null; job_posting_id: string | null; score: number };

// Load a match result plus its résumé and job posting (RLS keeps it to the user's own rows)
export async function loadMatchContext(
  supabase: Supa,
  matchId: string,
): Promise<{ match: Match; resume: Resume; job: Job } | { error: NextResponse }> {
  if (!matchId) return { error: fail("Missing match result.", 400) };

  const { data: match } = await supabase
    .from("match_results")
    .select("id, resume_id, job_posting_id, score")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return { error: fail("We couldn't find that match result.", 404) };
  if (!match.resume_id || !match.job_posting_id) {
    return { error: fail("The résumé or job posting for this result was deleted.", 410) };
  }

  const [{ data: resume }, { data: job }] = await Promise.all([
    supabase.from("resumes").select("id, file_name, file_path").eq("id", match.resume_id).maybeSingle(),
    supabase.from("job_postings").select("id, title, company, description").eq("id", match.job_posting_id).maybeSingle(),
  ]);
  if (!resume || !job) return { error: fail("The résumé or job posting for this result was deleted.", 410) };

  return { match: match as Match, resume: resume as Resume, job: job as Job };
}

export async function overDailyLimit(supabase: Supa, kind: ReportKind) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("ai_reports")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind)
    .eq("is_demo", false)
    .gte("created_at", since);
  return (count ?? 0) >= DAILY_LIMIT;
}

export type ResumeContent = {
  isPdf: boolean;
  bytes: Buffer;
  text: string; // plain text (Word files only)
  html: string; // simple HTML (Word files only), used to spot tables and images
};

// Download the résumé. Word files are turned into text here; PDFs are read by Claude directly.
export async function readResume(supabase: Supa, resume: Resume): Promise<ResumeContent | { error: NextResponse }> {
  const { data: file, error } = await supabase.storage.from("resumes").download(resume.file_path);
  if (error || !file) return { error: fail("We couldn't read that résumé file.", 500) };

  const bytes = Buffer.from(await file.arrayBuffer());
  const isPdf = resume.file_name.toLowerCase().endsWith(".pdf");
  if (isPdf) return { isPdf, bytes, text: "", html: "" };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import("mammoth");
    const extractRawText = mod.extractRawText ?? mod.default?.extractRawText;
    const convertToHtml = mod.convertToHtml ?? mod.default?.convertToHtml;
    const [raw, html] = await Promise.all([extractRawText({ buffer: bytes }), convertToHtml({ buffer: bytes })]);
    const text = String(raw.value ?? "").slice(0, MAX_RESUME_CHARS);
    if (!text.trim()) return { error: fail("That Word file doesn't seem to have any text.", 422) };
    return { isPdf, bytes, text, html: String(html.value ?? "") };
  } catch {
    return { error: fail("We couldn't read the text in that Word file.", 422) };
  }
}

export function jobBlock(job: Job) {
  return (
    `Job title: ${job.title}\nCompany: ${job.company ?? "Not given"}\n\n` +
    `<job_posting>\n${String(job.description).slice(0, MAX_JOB_CHARS)}\n</job_posting>`
  );
}

function resumeBlock(resume: ResumeContent) {
  return resume.isPdf ? "The candidate's résumé is the attached PDF." : `<resume>\n${resume.text}\n</resume>`;
}

// Ask Claude and force the answer into the given tool's structure
export async function askClaude(opts: {
  system: string;
  job: Job;
  resume: ResumeContent;
  instruction: string;
  tool: Anthropic.Tool;
  maxTokens?: number;
}): Promise<unknown> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = `${jobBlock(opts.job)}\n\n${resumeBlock(opts.resume)}\n\n${opts.instruction}`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 2500,
    system: opts.system,
    tools: [opts.tool],
    tool_choice: { type: "tool", name: opts.tool.name },
    messages: [
      {
        role: "user",
        content: [
          ...(opts.resume.isPdf
            ? [
                {
                  type: "document" as const,
                  source: {
                    type: "base64" as const,
                    media_type: "application/pdf" as const,
                    data: opts.resume.bytes.toString("base64"),
                  },
                },
              ]
            : []),
          { type: "text" as const, text: prompt },
        ],
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("NO_TOOL_RESULT");
  return toolUse.input;
}

// Turn any AI failure into a friendly message
export function aiError(err: unknown) {
  console.error("Claude API error:", err);
  if (err instanceof Anthropic.APIError) {
    if (err.status === 401) return fail("The AI service rejected the API key. Check ANTHROPIC_API_KEY.", 502);
    if (err.status === 429) return fail("The AI service is busy right now. Please try again in a minute.", 503);
  }
  if (err instanceof Error && err.message === "NO_TOOL_RESULT") {
    return fail("The AI didn't return a result. Please try again.", 502);
  }
  return fail("The AI request failed. Please try again.", 502);
}

export async function saveReport(
  supabase: Supa,
  row: { userId: string; matchId: string; kind: ReportKind; score: number | null; result: unknown; isDemo: boolean },
) {
  const { data: saved, error } = await supabase
    .from("ai_reports")
    .insert({
      user_id: row.userId,
      match_id: row.matchId,
      kind: row.kind,
      score: row.score,
      result: row.result,
      is_demo: row.isDemo,
    })
    .select()
    .single();

  if (error || !saved) return fail(error?.message ?? "We couldn't save the result.", 500);
  return NextResponse.json({ report: saved });
}
