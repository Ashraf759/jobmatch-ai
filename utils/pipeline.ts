// Client helpers that chain the AI features together.
// "Auto-tailor" = match a résumé to a job, then run the ATS check and tailoring on that match.

export type Step = "health" | "match" | "ats" | "tailor" | "copy" | "done";

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong. Please try again.");
  return json;
}

// Free health report for one résumé
export async function runHealth(resumeId: string) {
  return post("/api/resume-health", { resumeId });
}

// Full pipeline. Returns the new match result id.
export async function runPipeline(
  resumeId: string,
  jobId: string,
  onStep?: (step: Step) => void,
  options: { ats?: boolean; tailor?: boolean } = { ats: true, tailor: true },
) {
  onStep?.("match");
  const { match } = await post("/api/match", { resumeId, jobId });
  const matchId: string = match.id;

  const jobs: Promise<unknown>[] = [];
  onStep?.(options.ats ? "ats" : "tailor");
  if (options.ats) jobs.push(post("/api/ats", { matchId }));
  if (options.tailor) jobs.push(post("/api/tailor", { matchId }));
  // Run the ATS check and tailoring at the same time
  const results = await Promise.allSettled(jobs);
  onStep?.("done");
  const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
  return { matchId, warning: failed ? String(failed.reason?.message ?? failed.reason) : null };
}

export const STEP_LABEL: Record<Step, string> = {
  health: "Reading your résumé…",
  match: "Matching it to the job…",
  ats: "Running the ATS check and tailoring…",
  tailor: "Tailoring it for the job…",
  copy: "Creating your tailored copy…",
  done: "Done",
};
