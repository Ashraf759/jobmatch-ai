"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Nav from "@/components/Nav";

type JobPosting = {
  id: string;
  user_id: string;
  title: string;
  company: string | null;
  source_url: string | null;
  description: string;
  created_at: string;
};

const MAX_CHARS = 50000;

const inputClass =
  "h-[46px] w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 text-[15px] text-ink transition placeholder:text-faint focus:border-signal focus:shadow-[0_0_0_4px_rgba(42,69,214,0.15)] focus:outline-none";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function hostOf(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function initials(text: string) {
  return (
    text
      .split(/\s|&/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "JD"
  );
}

export default function JobsPage() {
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | undefined>();
  const [mode, setMode] = useState<"paste" | "url">("paste");
  const [url, setUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [viewing, setViewing] = useState<JobPosting | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function loadPostings() {
    const { data, error } = await supabase
      .from("job_postings")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) setPostings(data);
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
      loadPostings();
    }
    checkUserAndLoad();
  }, []);

  // Close the posting window with the Escape key
  useEffect(() => {
    if (!viewing) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setViewing(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewing]);

  function switchMode(next: "paste" | "url") {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function handleFetch() {
    setError(null);
    setNotice(null);
    const link = url.trim();
    if (!link) {
      setError("Paste a job posting link first.");
      return;
    }

    setFetching(true);
    try {
      const res = await fetch("/api/parse-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: link }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json.error ?? "We couldn't read that page. Try pasting the text instead.");
        return;
      }

      setTitle(json.title ?? "");
      setCompany(json.company ?? "");
      setDescription((json.description ?? "").slice(0, MAX_CHARS));
      setSourceUrl(json.source_url ?? link);
      setNotice("We filled in what we found. Check it, then save.");
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setFetching(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!title.trim() || !description.trim()) {
      setError("Please add a job title and the job description.");
      return;
    }

    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.push("/login");
      return;
    }

    setSaving(true);
    const link = sourceUrl || (mode === "url" ? url.trim() : "");
    const { error } = await supabase.from("job_postings").insert({
      title: title.trim(),
      company: company.trim() || null,
      source_url: link || null,
      description: description.trim(),
      user_id: data.user.id,
    });
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setTitle("");
    setCompany("");
    setDescription("");
    setUrl("");
    setSourceUrl("");
    setNotice("Job posting saved.");
    loadPostings();
  }

  async function handleDelete(posting: JobPosting) {
    if (!window.confirm(`Delete "${posting.title}"?`)) return;
    setError(null);
    setNotice(null);
    await supabase.from("job_postings").delete().eq("id", posting.id);
    if (viewing?.id === posting.id) setViewing(null);
    loadPostings();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="flex items-center gap-3 font-mono text-sm tracking-[0.08em] text-muted">
          <span className="h-2 w-2 animate-pulse-ring rounded-full bg-signal" />
          LOADING YOUR JOB POSTINGS
        </div>
      </div>
    );
  }

  const today = new Date()
    .toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
    .toUpperCase()
    .replace(",", " ·");

  const tabClass = (on: boolean) =>
    `flex min-h-10 cursor-pointer items-center justify-center rounded-[10px] text-sm font-semibold transition ${
      on ? "bg-card text-ink shadow-[0_2px_8px_-2px_rgba(20,22,27,0.2)]" : "text-muted hover:text-ink"
    }`;

  return (
    <div className="flex min-h-screen flex-col bg-paper font-body text-ink lg:flex-row">
      <Nav email={email} active="jobs" />

      <main className="flex min-w-0 flex-1 flex-col gap-7 px-6 py-9 lg:px-10">
        {/* ---------- Header ---------- */}
        <div className="flex flex-col gap-1.5">
          <div className="font-mono text-xs tracking-[0.1em] text-muted">{today}</div>
          <h1 className="font-display text-[44px] font-bold leading-none tracking-[-0.04em]">Job postings</h1>
          <p className="max-w-[620px] pt-1 text-[17px] leading-normal text-ink-2">
            Save the jobs you’re interested in. Paste the description, or fetch it from a link.
          </p>
        </div>

        <div className="flex flex-col gap-5 xl:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            {/* ---------- Add form ---------- */}
            <form
              onSubmit={handleSave}
              className="flex animate-fade-in flex-col gap-4 rounded-3xl border border-line bg-card p-6 md:p-8"
            >
              <div className="grid max-w-[360px] grid-cols-2 rounded-[14px] bg-paper-2 p-[5px]">
                <button type="button" aria-pressed={mode === "paste"} onClick={() => switchMode("paste")} className={tabClass(mode === "paste")}>
                  Paste text
                </button>
                <button type="button" aria-pressed={mode === "url"} onClick={() => switchMode("url")} className={tabClass(mode === "url")}>
                  From a link
                </button>
              </div>

              {mode === "url" && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="job-url" className="text-[13px] font-semibold">Job posting link</label>
                  <div className="flex flex-col gap-2.5 sm:flex-row">
                    <input
                      id="job-url"
                      type="url"
                      inputMode="url"
                      placeholder="https://boards.greenhouse.io/company/jobs/123"
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        setSourceUrl("");
                      }}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={handleFetch}
                      disabled={fetching}
                      className="h-[46px] shrink-0 cursor-pointer rounded-xl bg-ink px-5 text-[15px] font-semibold text-paper transition hover:-translate-y-px disabled:cursor-wait disabled:opacity-60"
                    >
                      {fetching ? "Fetching…" : "Fetch"}
                    </button>
                  </div>
                  <p className="text-xs text-muted">
                    Works best with company career pages. LinkedIn and Indeed usually block this, so paste the text for those.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="job-title" className="text-[13px] font-semibold">Job title</label>
                  <input
                    id="job-title"
                    placeholder="e.g. Frontend Engineer"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="job-company" className="text-[13px] font-semibold">
                    Company <span className="font-normal text-muted">(optional)</span>
                  </label>
                  <input
                    id="job-company"
                    placeholder="e.g. Northwind Labs"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-end justify-between gap-3">
                  <label htmlFor="job-description" className="text-[13px] font-semibold">Job description</label>
                  <span className="font-mono text-[11px] text-muted">
                    {description.length.toLocaleString()} / 50,000
                  </span>
                </div>
                <textarea
                  id="job-description"
                  placeholder="Paste the full job description here, including responsibilities and requirements."
                  value={description}
                  maxLength={MAX_CHARS}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[240px] w-full resize-y rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-[15px] leading-[1.55] text-ink transition placeholder:text-faint focus:border-signal focus:shadow-[0_0_0_4px_rgba(42,69,214,0.15)] focus:outline-none"
                />
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

              <button
                type="submit"
                disabled={saving}
                className="self-start cursor-pointer rounded-full bg-signal px-6 py-3 text-[15px] font-semibold text-white transition hover:-translate-y-px hover:shadow-[0_10px_24px_-12px_rgba(42,69,214,0.8)] disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {saving ? "Saving…" : "Save job posting"}
              </button>
            </form>

            {/* ---------- List ---------- */}
            <div className="flex flex-col gap-2">
              <div className="px-1 font-mono text-[11px] tracking-[0.08em] text-muted">
                SAVED POSTINGS · {postings.length}
              </div>

              {postings.map((p, i) => {
                const host = hostOf(p.source_url);
                return (
                  <div
                    key={p.id}
                    className="flex animate-fade-in flex-wrap items-center gap-4 rounded-2xl border-[1.5px] border-paper-2 bg-card px-[18px] py-3.5 transition hover:shadow-[0_10px_24px_-18px_rgba(20,22,27,0.45)]"
                    style={{ animationDelay: `${i * 0.04}s` }}
                  >
                    <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-amber-soft font-display text-[15px] font-bold text-amber-ink">
                      {initials(p.company || p.title)}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <span className="truncate text-[15px] font-semibold">{p.title}</span>
                      <span className="truncate text-[13px] text-muted">
                        {[p.company, host, `Saved ${formatDate(p.created_at)}`].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setViewing(p)}
                        className="min-h-10 cursor-pointer rounded-full border-[1.5px] border-line px-4 text-sm font-medium transition hover:border-ink"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p)}
                        aria-label={`Delete ${p.title}`}
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

              {postings.length === 0 && (
                <div className="rounded-[18px] border-[1.5px] border-dashed border-line p-10 text-center text-[15px] text-muted">
                  No job postings yet. Add your first one above.
                </div>
              )}
            </div>
          </div>

          {/* ---------- Side card ---------- */}
          <aside className="flex animate-slide-in flex-col gap-4 self-start rounded-3xl bg-ink bg-dots p-7 text-paper xl:sticky xl:top-9 xl:w-[340px] xl:shrink-0">
            <div className="font-mono text-[11px] tracking-[0.1em] text-signal-glow">NEXT UP · AI MATCH</div>
            <div className="font-display text-[26px] font-bold leading-[1.1] tracking-[-0.03em]">
              Postings + résumés = your match score.
            </div>
            <p className="text-[14px] leading-[1.55] text-fog">
              When AI Match is ready, you’ll pick a résumé and one of these postings, and JobMatch will show which skills line up and which are missing.
            </p>
            <div className="flex flex-col gap-2 pt-1 text-[13px] text-fog">
              <div className="flex gap-2"><span className="text-mint">✓</span>Include the full requirements section</div>
              <div className="flex gap-2"><span className="text-mint">✓</span>Check fetched text before saving</div>
              <div className="flex gap-2"><span className="text-mint">✓</span>Your postings are private to your account</div>
            </div>
          </aside>
        </div>
      </main>

      {/* ---------- Posting window ---------- */}
      {viewing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={viewing.title}
          onClick={() => setViewing(null)}
          className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-ink/60 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-[820px] flex-col overflow-hidden rounded-3xl bg-card shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)]"
          >
            <div className="flex flex-wrap items-center gap-4 border-b border-line px-6 py-4">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-display text-xl font-bold tracking-[-0.02em]">{viewing.title}</span>
                <span className="truncate text-[13px] text-muted">
                  {[viewing.company, `Saved ${formatDate(viewing.created_at)}`].filter(Boolean).join(" · ")}
                </span>
              </div>
              {viewing.source_url && (
                <a
                  href={viewing.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center rounded-full border-[1.5px] border-line px-4 text-sm font-medium text-ink transition hover:border-ink"
                >
                  Open original ↗
                </a>
              )}
              <button
                type="button"
                onClick={() => setViewing(null)}
                aria-label="Close"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] text-muted transition hover:bg-paper-2 hover:text-ink"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto whitespace-pre-wrap px-8 py-8 text-[15px] leading-[1.65] text-ink md:px-12">
              {viewing.description}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}