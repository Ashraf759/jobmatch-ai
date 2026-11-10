// Creates the tailored copy automatically: takes the latest tailoring result for a match,
// applies every suggested change to the real résumé text, builds a Word file,
// saves it as a new résumé version, and returns it so the browser can download it.
import { buildTailored, makeDocx, type Rewrite } from "@/utils/tailorDoc";
import { runHealth } from "@/utils/pipeline";

function safe(s: string) {
  return s.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50) || "resume";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createTailoredCopy(supabase: any, resumeId: string, matchId: string) {
  const [{ data: rep }, { data: match }, { data: resume }, { data: auth }] = await Promise.all([
    supabase
      .from("ai_reports")
      .select("id, result")
      .eq("match_id", matchId)
      .eq("kind", "tailor")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("match_results").select("job_title, company").eq("id", matchId).maybeSingle(),
    supabase.from("resumes").select("id, file_name, label, resume_text").eq("id", resumeId).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  if (!rep) throw new Error("The tailoring result wasn't found.");
  if (!resume?.resume_text) throw new Error("We couldn't read the text of this résumé, so a tailored copy can't be built.");
  if (!auth?.user) throw new Error("Please log in again.");

  const result = rep.result as { summary?: string; rewrites?: Rewrite[] };
  const tailored = buildTailored(resume.resume_text, {
    summary: result.summary || null,
    rewrites: result.rewrites ?? [],
    wording: [],
  });
  const blob = await makeDocx(tailored.lines);

  const base = resume.label || String(resume.file_name).replace(/\.[^.]+$/, "");
  const target = match?.company || match?.job_title || "job";
  const fileName = `${safe(base)}_${safe(target)}_tailored.docx`;
  const path = `${auth.user.id}/${Date.now()}-${fileName}`;

  const { error: upErr } = await supabase.storage.from("resumes").upload(path, blob, {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  if (upErr) throw new Error(upErr.message);

  const { data: row, error: insErr } = await supabase
    .from("resumes")
    .insert({
      file_name: fileName,
      file_path: path,
      file_size: blob.size,
      label: `${base} · ${target}`.slice(0, 60),
      is_default: false,
    })
    .select("id")
    .single();
  if (insErr || !row) {
    await supabase.storage.from("resumes").remove([path]);
    throw new Error(insErr?.message ?? "Couldn't save the tailored copy.");
  }

  // Give the new version its own health report
  await runHealth(row.id).catch(() => null);

  return { newResumeId: row.id as string, reportId: rep.id as string, fileName, blob, applied: tailored.applied };
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
