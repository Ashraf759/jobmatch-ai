// Résumé Health Report (free): reads the résumé text and scores it with our own rules.
// Runs automatically after every upload. No AI, no API cost.
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { analyzeResume } from "@/utils/resumeHealth";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_TEXT = 30_000;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// Pull plain text out of a PDF or Word file
async function extractText(bytes: Buffer, isPdf: boolean): Promise<string> {
  if (isPdf) {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await pdfText(pdf, { mergePages: true });
    return String(text ?? "");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import("mammoth");
  const extractRawText = mod.extractRawText ?? mod.default?.extractRawText;
  const out = await extractRawText({ buffer: bytes });
  return String(out.value ?? "");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail("Please log in first.", 401);

  let resumeId = "";
  try {
    const body = await request.json();
    resumeId = typeof body?.resumeId === "string" ? body.resumeId : "";
  } catch {
    // handled below
  }
  if (!resumeId) return fail("Missing résumé.", 400);

  // RLS makes sure this is the user's own résumé
  const { data: resume } = await supabase
    .from("resumes")
    .select("id, file_name, file_path")
    .eq("id", resumeId)
    .maybeSingle();
  if (!resume) return fail("We couldn't find that résumé.", 404);

  const { data: file, error: fileError } = await supabase.storage.from("resumes").download(resume.file_path);
  if (fileError || !file) return fail("We couldn't read that résumé file.", 500);

  let text = "";
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    text = (await extractText(bytes, String(resume.file_name).toLowerCase().endsWith(".pdf"))).slice(0, MAX_TEXT);
  } catch (err) {
    console.error("Text extraction failed:", err);
  }

  const health = analyzeResume(text);
  if (text.trim().length < 50) {
    // Usually a scanned image or a design-heavy file
    health.score = Math.min(health.score, 15);
    health.grade = "Needs work";
    health.issues.unshift({
      level: "high",
      title: "We couldn't read the text in this file",
      detail:
        "It may be a scanned image or use a complex design. ATS software will likely have the same problem. Try exporting a simple PDF or Word file.",
    });
  }

  const { error: saveError } = await supabase
    .from("resumes")
    .update({ health, health_score: health.score, resume_text: text })
    .eq("id", resume.id);
  if (saveError) return fail(saveError.message, 500);

  return NextResponse.json({ health });
}
