"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Nav from "@/components/Nav";

type Resume = {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  uploaded_at: string;
  label: string | null;
  is_default: boolean;
};

type Preview = { resume: Resume; html: string };

// How each résumé version has done in AI Match so far
type Stats = { count: number; best: number };

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_LABEL = 60;
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fileKind(name: string) {
  return name.toLowerCase().endsWith(".pdf") ? "PDF" : "DOCX";
}

// "resume_frontend_v2.pdf" -> "resume frontend v2"
function labelFromFileName(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim()
    .slice(0, MAX_LABEL);
}

function scoreClasses(score: number) {
  if (score >= 75) return "bg-green-soft text-green-ink";
  if (score >= 50) return "bg-amber-soft text-amber-ink";
  return "bg-rust-soft text-rust-ink";
}

export default function ResumesPage() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  async function loadResumes() {
    const { data, error } = await supabase
      .from("resumes")
      .select("*")
      .order("is_default", { ascending: false })
      .order("uploaded_at", { ascending: false });

    if (!error && data) setResumes(data);

    // Count matches and find the best score for each résumé version
    const { data: matches } = await supabase.from("match_results").select("resume_id, score");
    const next: Record<string, Stats> = {};
    for (const m of matches ?? []) {
      if (!m.resume_id) continue;
      const s = next[m.resume_id] ?? { count: 0, best: 0 };
      s.count += 1;
      s.best = Math.max(s.best, m.score ?? 0);
      next[m.resume_id] = s;
    }
    setStats(next);
    setLoading(false);
  }

  useEffect(() => {
    async function checkUserAndLoad() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }
      setEmail(data.user.email);
      loadResumes();
    }
    checkUserAndLoad();
  }, []);

  // Close the Word preview with the Escape key
  useEffect(() => {
    if (!preview) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreview(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  async function handleFile(file: File) {
    setError(null);
    setNotice(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please choose a PDF or Word (.docx) file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That file is bigger than 5 MB. Please choose a smaller file.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push("/login");
      return;
    }

    setUploading(true);

    // Files go in a folder named after the user's id (matches our storage rules)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userData.user.id}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      setUploading(false);
      setError(uploadError.message);
      return;
    }

    // The very first résumé becomes the default automatically
    const { error: insertError } = await supabase.from("resumes").insert({
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      label: labelFromFileName(file.name) || null,
      is_default: resumes.length === 0,
    });

    if (insertError) {
      // Clean up the file so we don't leave an orphan behind
      await supabase.storage.from("resumes").remove([path]);
      setUploading(false);
      setError(insertError.message);
      return;
    }

    setUploading(false);
    setNotice(`Uploaded ${file.name}. Give it a clear version name so you can tell it apart.`);
    loadResumes();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets you pick the same file again later
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  // ---------- Version name ----------
  function startEditing(resume: Resume) {
    setEditingId(resume.id);
    setDraftLabel(resume.label ?? labelFromFileName(resume.file_name));
  }

  async function saveLabel(resume: Resume) {
    const label = draftLabel.trim().slice(0, MAX_LABEL);
    setEditingId(null);
    if (label === (resume.label ?? "")) return;

    setSavingId(resume.id);
    setError(null);
    const { error } = await supabase
      .from("resumes")
      .update({ label: label || null })
      .eq("id", resume.id);
    setSavingId(null);

    if (error) {
      setError(error.message);
      return;
    }
    setResumes((list) => list.map((r) => (r.id === resume.id ? { ...r, label: label || null } : r)));
  }

  // ---------- Default version ----------
  async function makeDefault(resume: Resume) {
    setSavingId(resume.id);
    setError(null);
    setNotice(null);

    // Only one default per person: clear the old one first, then set the new one
    const { error: clearError } = await supabase
      .from("resumes")
      .update({ is_default: false })
      .eq("is_default", true);
    const { error: setErr } = clearError
      ? { error: clearError }
      : await supabase.from("resumes").update({ is_default: true }).eq("id", resume.id);

    setSavingId(null);
    if (setErr) {
      setError(setErr.message);
      return;
    }
    setNotice(`${resume.label || resume.file_name} is now your default résumé.`);
    loadResumes();
  }

  // PDF: open in a new tab. Word: convert to a readable preview on this page.
  async function handleOpen(resume: Resume) {
    setError(null);
    const isPdf = fileKind(resume.file_name) === "PDF";

    // Open the tab right away so the browser doesn't block it as a pop-up
    const tab = isPdf ? window.open("", "_blank") : null;
    if (!isPdf) setOpeningId(resume.id);

    const { data, error } = await supabase.storage.from("resumes").download(resume.file_path);

    if (error || !data) {
      tab?.close();
      setOpeningId(null);
      setError(error?.message ?? "Couldn't open that file.");
      return;
    }

    if (isPdf) {
      const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
      if (tab) tab.location.href = url;
      else window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return;
    }

    try {
      // Load mammoth only when needed, then turn the .docx into HTML in the browser
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import("mammoth");
      const convertToHtml = mod.convertToHtml ?? mod.default?.convertToHtml;
      const result = await convertToHtml({ arrayBuffer: await data.arrayBuffer() });
      setPreview({ resume, html: result.value });
    } catch {
      setError("Couldn't preview this Word file. You can still download it.");
    }
    setOpeningId(null);
  }

  async function handleDownload(resume: Resume) {
    setError(null);
    const { data, error } = await supabase.storage.from("resumes").download(resume.file_path);
    if (error || !data) {
      setError(error?.message ?? "Couldn't download that file.");
      return;
    }
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = resume.file_name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function handleDelete(resume: Resume) {
    if (!window.confirm(`Delete ${resume.label || resume.file_name}?`)) return;
    setError(null);
    setNotice(null);

    const { error: storageError } = await supabase.storage.from("resumes").remove([resume.file_path]);
    if (storageError) {
      setError(storageError.message);
      return;
    }

    await supabase.from("resumes").delete().eq("id", resume.id);

    // If the default was deleted, the newest remaining résumé takes over
    if (resume.is_default) {
      const next = resumes.find((r) => r.id !== resume.id);
      if (next) await supabase.from("resumes").update({ is_default: true }).eq("id", next.id);
    }
    loadResumes();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="flex items-center gap-3 font-mono text-sm tracking-[0.08em] text-muted">
          <span className="h-2 w-2 animate-pulse-ring rounded-full bg-signal" />
          LOADING YOUR RÉSUMÉS
        </div>
      </div>
    );
  }

  const today = new Date()
    .toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
    .toUpperCase()
    .replace(",", " ·");

  // Which version has the single highest match score so far
  let topId: string | null = null;
  let topScore = -1;
  for (const r of resumes) {
    const s = stats[r.id];
    if (s && s.best > topScore) {
      topScore = s.best;
      topId = r.id;
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper font-body text-ink lg:flex-row">
      <Nav email={email} active="resumes" />

      <main className="flex min-w-0 flex-1 flex-col gap-7 px-6 py-9 lg:px-10">
        {/* ---------- Header ---------- */}
        <div className="flex flex-col gap-1.5">
          <div className="font-mono text-xs tracking-[0.1em] text-muted">{today}</div>
          <h1 className="font-display text-[44px] font-bold leading-none tracking-[-0.04em]">Résumés</h1>
          <p className="max-w-[620px] pt-1 text-[17px] leading-normal text-ink-2">
            Keep a version of your résumé for each kind of role. Name each one, pick a default, and see which version matches jobs best.
          </p>
        </div>

        <div className="flex flex-col gap-5 xl:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            {/* ---------- Drop zone ---------- */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`flex animate-fade-in flex-col items-center gap-4 rounded-3xl border-2 border-dashed p-10 text-center transition ${
                dragging ? "border-signal bg-signal-soft" : "border-line bg-card"
              }`}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-signal-soft text-signal">
                {uploading ? (
                  <span className="h-3 w-3 animate-pulse-ring rounded-full bg-signal" />
                ) : (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 16V4M7 9l5-5 5 5" />
                    <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                  </svg>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="font-display text-2xl font-bold tracking-[-0.02em]">
                  {uploading ? "Uploading…" : dragging ? "Drop it here" : "Drag a résumé here"}
                </div>
                <div className="text-sm text-muted">PDF or Word (.docx), up to 5 MB</div>
              </div>
              <input
                ref={inputRef}
                id="resume-file"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleInputChange}
                className="sr-only"
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="cursor-pointer rounded-full bg-signal px-6 py-3 text-[15px] font-semibold text-white transition hover:-translate-y-px hover:shadow-[0_10px_24px_-12px_rgba(42,69,214,0.8)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                Browse files
              </button>
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-rust-soft px-4 py-3 text-sm text-rust-ink">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="animate-fade-in rounded-xl bg-green-soft px-4 py-3 text-sm text-green-ink">
                {notice}
              </p>
            )}

            {/* ---------- List ---------- */}
            <div className="flex flex-col gap-2">
              <div className="px-1 font-mono text-[11px] tracking-[0.08em] text-muted">
                YOUR VERSIONS · {resumes.length}
              </div>

              {resumes.map((r, i) => {
                const kind = fileKind(r.file_name);
                const s = stats[r.id];
                const busy = savingId === r.id;
                return (
                  <div
                    key={r.id}
                    className={`flex animate-fade-in flex-wrap items-center gap-4 rounded-2xl border-[1.5px] bg-card px-[18px] py-3.5 transition hover:shadow-[0_10px_24px_-18px_rgba(20,22,27,0.45)] ${
                      r.is_default ? "border-signal" : "border-paper-2"
                    }`}
                    style={{ animationDelay: `${i * 0.04}s` }}
                  >
                    <span
                      className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl font-mono text-[11px] font-bold ${
                        kind === "PDF" ? "bg-rust-soft text-rust-ink" : "bg-signal-soft text-signal-deep"
                      }`}
                    >
                      {kind}
                    </span>

                    <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      {editingId === r.id ? (
                        <input
                          autoFocus
                          aria-label="Version name"
                          value={draftLabel}
                          maxLength={MAX_LABEL}
                          onChange={(e) => setDraftLabel(e.target.value)}
                          onBlur={() => saveLabel(r)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveLabel(r);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          placeholder="e.g. Frontend v2"
                          className="h-9 max-w-[360px] rounded-lg border-[1.5px] border-signal bg-white px-3 text-[15px] font-semibold outline-none ring-4 ring-signal/15"
                        />
                      ) : (
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEditing(r)}
                            title="Rename this version"
                            className="group flex min-w-0 cursor-pointer items-center gap-1.5 text-left"
                          >
                            <span className="truncate text-[15px] font-semibold">{r.label || r.file_name}</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-faint transition group-hover:text-signal">
                              <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />
                            </svg>
                          </button>
                          {r.is_default && (
                            <span className="rounded-full bg-signal-soft px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.08em] text-signal-deep">
                              DEFAULT
                            </span>
                          )}
                          {topId === r.id && resumes.length > 1 && (
                            <span className="rounded-full bg-green-soft px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.08em] text-green-ink">
                              TOP SCORER
                            </span>
                          )}
                        </div>
                      )}
                      <span className="truncate text-[13px] text-muted">
                        {r.label ? `${r.file_name} · ` : ""}
                        {formatSize(r.file_size)} · Uploaded {formatDate(r.uploaded_at)}
                      </span>
                    </div>

                    {/* Match history for this version */}
                    {s ? (
                      <span
                        className={`rounded-full px-3 py-1 font-mono text-[12px] font-semibold ${scoreClasses(s.best)}`}
                        title={`Matched against ${s.count} job${s.count === 1 ? "" : "s"}`}
                      >
                        BEST {s.best}% · {s.count} JOB{s.count === 1 ? "" : "S"}
                      </span>
                    ) : (
                      <span className="font-mono text-[12px] text-faint">NOT MATCHED YET</span>
                    )}

                    <div className="flex items-center gap-2">
                      {!r.is_default && (
                        <button
                          type="button"
                          onClick={() => makeDefault(r)}
                          disabled={busy}
                          className="min-h-10 cursor-pointer rounded-full px-3 text-sm font-medium text-muted transition hover:bg-paper-2 hover:text-ink disabled:cursor-wait disabled:opacity-60"
                        >
                          {busy ? "Saving…" : "Make default"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpen(r)}
                        disabled={openingId === r.id}
                        className="min-h-10 cursor-pointer rounded-full border-[1.5px] border-line px-4 text-sm font-medium transition hover:border-ink disabled:cursor-wait disabled:opacity-60"
                      >
                        {openingId === r.id ? "Opening…" : "View"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r)}
                        aria-label={`Delete ${r.label || r.file_name}`}
                        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] text-faint transition hover:bg-rust-soft hover:text-rust-ink"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}

              {resumes.length === 0 && (
                <div className="rounded-[18px] border-[1.5px] border-dashed border-line p-10 text-center text-[15px] text-muted">
                  No résumés yet. Upload your first one above.
                </div>
              )}
            </div>
          </div>

          {/* ---------- Side card ---------- */}
          <aside className="flex animate-slide-in flex-col gap-4 self-start rounded-3xl bg-ink bg-dots p-7 text-paper xl:sticky xl:top-9 xl:w-[340px] xl:shrink-0">
            <div className="font-mono text-[11px] tracking-[0.1em] text-signal-glow">RÉSUMÉ VERSIONS</div>
            <div className="font-display text-[26px] font-bold leading-[1.1] tracking-[-0.03em]">
              One résumé per kind of role.
            </div>
            <p className="text-[14px] leading-[1.55] text-fog">
              Your default version is picked first in AI Match. Run the same job against two versions and the best score tells you which one to send.
            </p>
            <div className="flex flex-col gap-2 pt-1 text-[13px] text-fog">
              <div className="flex gap-2"><span className="text-mint">✓</span>Click a name to rename that version</div>
              <div className="flex gap-2"><span className="text-mint">✓</span>Use names like “Frontend v2” or “Data analyst”</div>
              <div className="flex gap-2"><span className="text-mint">✓</span>Your files are private to your account</div>
            </div>
          </aside>
        </div>
      </main>

      {/* ---------- Word preview window ---------- */}
      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview of ${preview.resume.file_name}`}
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-ink/60 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-[820px] flex-col overflow-hidden rounded-3xl bg-card shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)]"
          >
            <div className="flex flex-wrap items-center gap-4 border-b border-line px-6 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-soft font-mono text-[11px] font-bold text-signal-deep">
                DOCX
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[15px] font-semibold">{preview.resume.label || preview.resume.file_name}</span>
                <span className="text-xs text-muted">Preview · formatting is simplified</span>
              </div>
              <button
                type="button"
                onClick={() => handleDownload(preview.resume)}
                className="min-h-10 cursor-pointer rounded-full bg-ink px-4 text-sm font-semibold text-paper transition hover:-translate-y-px"
              >
                Download
              </button>
              <button
                type="button"
                onClick={() => setPreview(null)}
                aria-label="Close preview"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] text-muted transition hover:bg-paper-2 hover:text-ink"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div
              className="overflow-y-auto px-8 py-8 text-[15px] leading-[1.6] text-ink md:px-12 [&_a]:text-signal [&_a]:underline [&_h1]:mb-3 [&_h1]:font-display [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mb-1 [&_h3]:mt-4 [&_h3]:font-semibold [&_li]:mb-1 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-2.5 [&_strong]:font-semibold [&_table]:mb-3 [&_table]:w-full [&_td]:border [&_td]:border-line [&_td]:p-2 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6"
              dangerouslySetInnerHTML={{ __html: preview.html || "<p>This file has no text to preview.</p>" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
