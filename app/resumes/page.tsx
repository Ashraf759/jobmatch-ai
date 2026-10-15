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
};

type Preview = { resume: Resume; html: string };

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
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

export default function ResumesPage() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  async function loadResumes() {
    const { data, error } = await supabase
      .from("resumes")
      .select("*")
      .order("uploaded_at", { ascending: false });

    if (!error && data) setResumes(data);
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

    const { error: insertError } = await supabase.from("resumes").insert({
      file_name: file.name,
      file_path: path,
      file_size: file.size,
    });

    if (insertError) {
      // Clean up the file so we don't leave an orphan behind
      await supabase.storage.from("resumes").remove([path]);
      setUploading(false);
      setError(insertError.message);
      return;
    }

    setUploading(false);
    setNotice(`Uploaded ${file.name}`);
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
    if (!window.confirm(`Delete ${resume.file_name}?`)) return;
    setError(null);
    setNotice(null);

    const { error: storageError } = await supabase.storage.from("resumes").remove([resume.file_path]);
    if (storageError) {
      setError(storageError.message);
      return;
    }

    await supabase.from("resumes").delete().eq("id", resume.id);
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

  return (
    <div className="flex min-h-screen flex-col bg-paper font-body text-ink lg:flex-row">
      <Nav email={email} active="resumes" />

      <main className="flex min-w-0 flex-1 flex-col gap-7 px-6 py-9 lg:px-10">
        {/* ---------- Header ---------- */}
        <div className="flex flex-col gap-1.5">
          <div className="font-mono text-xs tracking-[0.1em] text-muted">{today}</div>
          <h1 className="font-display text-[44px] font-bold leading-none tracking-[-0.04em]">Résumés</h1>
          <p className="max-w-[620px] pt-1 text-[17px] leading-normal text-ink-2">
            Upload the résumés you apply with. When AI Match is ready, you’ll pick one to compare with a job posting.
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
                YOUR RÉSUMÉS · {resumes.length}
              </div>

              {resumes.map((r, i) => {
                const kind = fileKind(r.file_name);
                return (
                  <div
                    key={r.id}
                    className="flex animate-fade-in flex-wrap items-center gap-4 rounded-2xl border-[1.5px] border-paper-2 bg-card px-[18px] py-3.5 transition hover:shadow-[0_10px_24px_-18px_rgba(20,22,27,0.45)]"
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
                      <span className="truncate text-[15px] font-semibold">{r.file_name}</span>
                      <span className="text-[13px] text-muted">
                        {formatSize(r.file_size)} · Uploaded {formatDate(r.uploaded_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
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
                        aria-label={`Delete ${r.file_name}`}
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
            <div className="font-mono text-[11px] tracking-[0.1em] text-signal-glow">NEXT UP · AI MATCH</div>
            <div className="font-display text-[26px] font-bold leading-[1.1] tracking-[-0.03em]">
              Your résumés power the match score.
            </div>
            <p className="text-[14px] leading-[1.55] text-fog">
              When AI Match is ready, you’ll choose one of these résumés and a job posting, and JobMatch will show which skills line up and which are missing.
            </p>
            <div className="flex flex-col gap-2 pt-1 text-[13px] text-fog">
              <div className="flex gap-2"><span className="text-mint">✓</span>Keep one résumé per kind of role</div>
              <div className="flex gap-2"><span className="text-mint">✓</span>Name files clearly, like resume_frontend.pdf</div>
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
                <span className="truncate text-[15px] font-semibold">{preview.resume.file_name}</span>
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