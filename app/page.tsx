"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";

type Job = {
  title: string;
  company: string;
  where: string;
  score: number;
  chips: [string, boolean][];
};

const JOBS: Job[] = [
  {
    title: "Frontend Engineer",
    company: "Northwind Labs",
    where: "Boston, MA",
    score: 87,
    chips: [["React", true], ["TypeScript", true], ["REST APIs", false], ["SQL", true]],
  },
  {
    title: "Data Analyst Intern",
    company: "Harbor Analytics",
    where: "Remote",
    score: 74,
    chips: [["SQL", true], ["Python", true], ["Tableau", false], ["Statistics", false]],
  },
  {
    title: "Full-Stack Developer",
    company: "Copperline",
    where: "New York, NY",
    score: 91,
    chips: [["Next.js", true], ["Postgres", true], ["TypeScript", true], ["Docker", false]],
  },
];

const ROLES = [
  "Frontend Engineer",
  "Data Analyst",
  "Product Designer",
  "ML Engineer Intern",
  "Full-Stack Developer",
  "Cloud Engineer",
];

const RING = 339.3;

const lift =
  "transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-10px_rgba(20,22,27,0.5)]";
const cardLift =
  "transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_40px_-24px_rgba(20,22,27,0.35)]";

function LogoMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="32" height="32" rx="10" fill="#14161B" />
      <circle cx="13.5" cy="17" r="6" stroke="#F5F2EB" strokeWidth="2.2" />
      <circle cx="20.5" cy="17" r="6" stroke="#7C93FF" strokeWidth="2.2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1E7A5C" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

function SmallArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5A5E69" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function Home() {
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(0);
  const [mounted, setMounted] = useState(false);
  const job = JOBS[idx];

  // Start the ring animation and cycle through jobs
  useEffect(() => {
    const start = setTimeout(() => setMounted(true), 150);
    const cycle = setInterval(() => setIdx((i) => (i + 1) % JOBS.length), 4600);
    return () => {
      clearTimeout(start);
      clearInterval(cycle);
    };
  }, []);

  // Count the number up or down toward the current job's score
  useEffect(() => {
    const target = job.score;
    const tick = setInterval(() => {
      setShown((cur) => {
        if (cur === target) return cur;
        const step = Math.max(1, Math.ceil(Math.abs(target - cur) / 12));
        return cur < target ? Math.min(target, cur + step) : Math.max(target, cur - step);
      });
    }, 30);
    return () => clearInterval(tick);
  }, [job.score]);

  const ringOffset = mounted ? RING * (1 - job.score / 100) : RING;

  return (
    <div className="mx-auto min-h-screen max-w-[1440px] overflow-x-hidden bg-paper font-body text-ink">
      {/* ---------- Header ---------- */}
      <header className="flex h-[88px] items-center justify-between border-b border-line px-6 lg:px-20">
        <Link href="/" className="flex items-center gap-3 text-ink no-underline">
          <LogoMark />
          <span className="font-display text-[22px] font-bold tracking-[-0.02em]">JobMatch</span>
          <span className="rounded-md bg-ink px-[7px] py-[3px] font-mono text-[11px] font-semibold tracking-[0.06em] text-paper">
            AI
          </span>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-9 text-[15px] md:flex">
          <a href="#how" className="text-ink-2 hover:text-ink">How it works</a>
          <a href="#pipeline" className="text-ink-2 hover:text-ink">Pipeline</a>
          <a href="#ai" className="text-ink-2 hover:text-ink">AI matching</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="px-[18px] py-3 text-[15px] font-medium text-ink">
            Sign in
          </Link>
          <Link href="/signup" className={`rounded-full bg-ink px-[22px] py-[13px] text-[15px] font-semibold text-paper ${lift}`}>
            Get started
          </Link>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="grid grid-cols-1 items-center gap-16 px-6 pb-16 pt-[72px] lg:grid-cols-2 lg:px-20">
        <div className="flex flex-col gap-7">
          <div className="flex animate-fade-up items-center gap-2.5 font-mono text-[13px] uppercase tracking-[0.08em] text-ink-2">
            <span className="h-2 w-2 animate-pulse-ring rounded-full bg-signal" />
            Your job search, organized
          </div>
          <h1 className="animate-fade-up font-display text-5xl font-bold leading-[0.98] tracking-[-0.045em] [animation-delay:120ms] lg:text-[84px]">
            Every application. <span className="text-signal">One clear</span> pipeline.
          </h1>
          <p className="max-w-[540px] animate-fade-up text-xl leading-[1.55] text-ink-2 [animation-delay:240ms]">
            Track every role you apply to, see exactly where each one stands, and let AI score how well your résumé fits a job before you hit submit.
          </p>
          <div className="flex animate-fade-up flex-wrap items-center gap-3.5 [animation-delay:360ms]">
            <Link href="/signup" className={`inline-flex items-center gap-2.5 rounded-full bg-signal px-7 py-[18px] text-[17px] font-semibold text-white ${lift}`}>
              Start tracking free
              <ArrowIcon />
            </Link>
            <a href="#how" className={`rounded-full border-[1.5px] border-ink px-[26px] py-[17px] text-[17px] font-semibold text-ink ${lift}`}>
              See how it works
            </a>
          </div>
          <div className="flex animate-fade-up flex-wrap gap-7 pt-3 text-sm text-ink-2 [animation-delay:360ms]">
            <div className="flex items-center gap-2"><CheckIcon />Private to your account</div>
            <div className="flex items-center gap-2"><CheckIcon />Status at a glance</div>
            <div className="flex items-center gap-2"><CheckIcon />Résumé matching</div>
          </div>
        </div>

        {/* Live match scene */}
        <div className="relative hidden h-[640px] overflow-hidden rounded-[32px] bg-ink bg-dots lg:block">
          <div className="absolute left-9 top-[30px] font-mono text-xs uppercase tracking-[0.1em] text-mist">
            Live match · preview
          </div>

          {/* Résumé card */}
          <div className="absolute left-11 top-[92px] flex h-[320px] w-[250px] animate-float-a flex-col gap-3 rounded-[18px] bg-card p-[22px] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-signal-soft font-display font-bold text-signal">
                BD
              </div>
              <div className="flex flex-col gap-[3px]">
                <div className="text-sm font-semibold">Your résumé</div>
                <div className="text-xs text-muted">resume_v4.pdf</div>
              </div>
            </div>
            <div className="h-px bg-paper-2" />
            <div className="font-mono text-[10px] tracking-[0.1em] text-muted">EXPERIENCE</div>
            <div className="h-2 w-[92%] rounded bg-paper-2" />
            <div className="h-2 w-[76%] rounded bg-paper-2" />
            <div className="h-2 w-[84%] rounded bg-paper-2" />
            <div className="pt-1.5 font-mono text-[10px] tracking-[0.1em] text-muted">SKILLS</div>
            <div className="flex flex-wrap gap-1.5">
              {["React", "TypeScript", "SQL", "Python"].map((s) => (
                <span key={s} className="rounded-md bg-signal-soft px-2 py-1 text-[11px] text-signal-deep">
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Job posting card */}
          <div className="absolute right-10 top-[70px] flex w-[260px] animate-float-b flex-col gap-2.5 rounded-[18px] bg-card p-[22px] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)]">
            <div className="font-mono text-[10px] tracking-[0.1em] text-muted">JOB POSTING</div>
            <div className="font-display text-xl font-bold leading-[1.15] tracking-[-0.02em]">{job.title}</div>
            <div className="text-[13px] text-muted">
              {job.company} · {job.where}
            </div>
            <div className="my-1 h-px bg-paper-2" />
            <div className="text-xs font-semibold">Looking for</div>
            <div className="flex flex-col gap-[7px]">
              {job.chips.map(([label, have], i) => (
                <div
                  key={`${idx}-${label}`}
                  className={`flex animate-pop items-center justify-between rounded-lg px-2.5 py-[7px] text-xs ${
                    have ? "bg-signal-soft text-signal-deep" : "bg-amber-soft text-amber-ink"
                  }`}
                  style={{ animationDelay: `${i * 0.08 + 0.1}s` }}
                >
                  <span>{label}</span>
                  <span className="font-mono text-[11px]">{have ? "✓ on résumé" : "— missing"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Match ring */}
          <div className="absolute left-1/2 top-[360px] -ml-[110px] flex h-[220px] w-[220px] items-center justify-center rounded-full border border-ink-border bg-ink-soft shadow-[0_0_0_14px_rgba(42,69,214,0.08)]">
            <svg width="180" height="180" viewBox="0 0 120 120" aria-hidden="true" className="absolute -rotate-90">
              <circle cx="60" cy="60" r="54" fill="none" stroke="#2E323C" strokeWidth="8" />
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="#7C93FF"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={RING}
                strokeDashoffset={ringOffset}
                style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.2,0.7,0.2,1)" }}
              />
            </svg>
            <div className="flex flex-col items-center gap-0.5 text-paper">
              <div className="font-display text-[54px] font-bold leading-none tracking-[-0.04em]">
                {shown}
                <span className="text-2xl text-mist">%</span>
              </div>
              <div className="font-mono text-[11px] tracking-[0.12em] text-mist">MATCH SCORE</div>
            </div>
          </div>

          {/* Toast */}
          <div className="absolute bottom-8 left-9 flex animate-toast items-center gap-3 rounded-[14px] bg-paper py-3 pl-3 pr-4">
            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-amber-soft">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A5A0B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 2v4M16 2v4" />
                <rect x="3" y="5" width="18" height="16" rx="3" />
                <path d="M3 10h18" />
              </svg>
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="text-[13px] font-semibold">Moved to Interview</div>
              <div className="text-xs text-muted">{job.company} · just now</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Ticker ---------- */}
      <div className="flex h-[76px] items-center overflow-hidden border-y border-line">
        <div className="flex animate-marquee gap-14 whitespace-nowrap pl-14 font-display text-[26px] font-medium tracking-[-0.02em] text-faint">
          {[...ROLES, ...ROLES].map((r, i) => (
            <Fragment key={i}>
              <span>{r}</span>
              <span className="text-signal">✳</span>
            </Fragment>
          ))}
        </div>
      </div>

      {/* ---------- How it works ---------- */}
      <section id="how" className="flex flex-col gap-14 px-6 pb-24 pt-28 lg:px-20">
        <div className="flex flex-col justify-between gap-10 lg:flex-row lg:items-end">
          <h2 className="max-w-[640px] font-display text-4xl font-bold leading-none tracking-[-0.04em] lg:text-[60px]">
            Three steps from “applied” to “accepted.”
          </h2>
          <p className="max-w-[420px] text-lg leading-[1.55] text-ink-2">
            No spreadsheets, no lost links. Every role lives on one board you can update in a click.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* 01 */}
          <article className={`flex flex-col gap-5 rounded-3xl border border-line bg-card p-8 ${cardLift}`}>
            <div className="font-mono text-[13px] font-semibold text-signal">01 — ADD</div>
            <div className="flex h-[150px] flex-col gap-2.5 rounded-2xl bg-paper-2 p-[18px]">
              <div className="flex h-9 items-center rounded-[10px] border border-line bg-card px-3 text-[13px]">
                Northwind Labs
              </div>
              <div className="flex h-9 items-center rounded-[10px] border-[1.5px] border-signal bg-card px-3 text-[13px]">
                Frontend Engineer
                <span className="ml-0.5 h-4 w-[1.5px] bg-signal" />
              </div>
              <div className="self-end rounded-full bg-ink px-3.5 py-2 text-xs font-semibold text-paper">Save role</div>
            </div>
            <h3 className="font-display text-[26px] font-bold tracking-[-0.02em]">Add the role</h3>
            <p className="text-base leading-[1.55] text-ink-2">
              Company, title, and where you found it. Takes about ten seconds.
            </p>
          </article>

          {/* 02 */}
          <article className={`flex flex-col gap-5 rounded-3xl border border-line bg-card p-8 ${cardLift}`}>
            <div className="font-mono text-[13px] font-semibold text-signal">02 — MOVE</div>
            <div className="flex h-[150px] items-center justify-center gap-2 rounded-2xl bg-paper-2 p-[18px]">
              <span className="rounded-full bg-signal-soft px-[11px] py-[7px] text-xs font-semibold text-signal-deep">Applied</span>
              <SmallArrow />
              <span className="rounded-full bg-amber-soft px-[11px] py-[7px] text-xs font-semibold text-amber-ink">Interview</span>
              <SmallArrow />
              <span className="rounded-full bg-green-soft px-[11px] py-[7px] text-xs font-semibold text-green-ink">Offer</span>
            </div>
            <h3 className="font-display text-[26px] font-bold tracking-[-0.02em]">Move it forward</h3>
            <p className="text-base leading-[1.55] text-ink-2">
              Update the status as things happen. Your pipeline stays honest.
            </p>
          </article>

          {/* 03 */}
          <article className={`flex flex-col gap-5 rounded-3xl bg-ink p-8 text-paper ${cardLift}`}>
            <div className="flex items-center justify-between">
              <div className="font-mono text-[13px] font-semibold text-signal-glow">03 — MATCH</div>
              <span className="rounded-md border border-ink-2 px-2 py-1 font-mono text-[11px] text-fog">COMING SOON</span>
            </div>
            <div className="flex h-[150px] flex-col justify-center gap-3 rounded-2xl bg-ink-soft p-[18px]">
              <div className="flex justify-between text-[13px]">
                <span>Keyword coverage</span>
                <span className="font-mono">82%</span>
              </div>
              <div className="h-2 rounded-full bg-ink-line">
                <div className="h-2 w-[82%] rounded-full bg-signal-glow" />
              </div>
              <div className="flex justify-between text-[13px]">
                <span>ATS readability</span>
                <span className="font-mono">74%</span>
              </div>
              <div className="h-2 rounded-full bg-ink-line">
                <div className="h-2 w-[74%] rounded-full bg-amber" />
              </div>
            </div>
            <h3 className="font-display text-[26px] font-bold tracking-[-0.02em]">Match &amp; tailor</h3>
            <p className="text-base leading-[1.55] text-fog">
              Score your résumé against the posting and get suggestions to close the gaps.
            </p>
          </article>
        </div>
      </section>

      {/* ---------- Pipeline preview ---------- */}
      <section id="pipeline" className="mx-6 grid grid-cols-1 items-center gap-12 rounded-[32px] bg-paper-2 p-10 lg:mx-20 lg:grid-cols-5 lg:p-[72px]">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <div className="font-mono text-[13px] tracking-[0.08em] text-ink-2">THE PIPELINE</div>
          <h2 className="font-display text-4xl font-bold leading-[1.02] tracking-[-0.04em] lg:text-[52px]">
            Your whole search on one board.
          </h2>
          <p className="text-lg leading-[1.55] text-ink-2">
            See what’s waiting on you, what’s waiting on them, and what needs a follow-up — without opening ten tabs.
          </p>
          <Link href="/tracker" className="inline-flex items-center gap-2 text-[17px] font-semibold text-signal">
            Open the tracker <ArrowIcon />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-4 lg:col-span-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <span className="h-[9px] w-[9px] rounded-full bg-signal" />Applied<span className="font-normal text-muted">3</span>
            </div>
            <div className={`flex flex-col gap-1.5 rounded-[14px] bg-card p-4 ${cardLift}`}>
              <div className="text-sm font-semibold">Frontend Engineer</div>
              <div className="text-xs text-muted">Northwind Labs</div>
            </div>
            <div className={`flex flex-col gap-1.5 rounded-[14px] bg-card p-4 ${cardLift}`}>
              <div className="text-sm font-semibold">ML Engineer Intern</div>
              <div className="text-xs text-muted">Fieldstone AI</div>
            </div>
            <div className={`flex flex-col gap-1.5 rounded-[14px] bg-card p-4 ${cardLift}`}>
              <div className="text-sm font-semibold">Cloud Engineer</div>
              <div className="text-xs text-muted">Stratus Works</div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <span className="h-[9px] w-[9px] rounded-full bg-amber" />Interview<span className="font-normal text-muted">2</span>
            </div>
            <div className={`flex flex-col gap-1.5 rounded-[14px] bg-card p-4 shadow-[0_0_0_2px_#F0A93B] ${cardLift}`}>
              <div className="text-sm font-semibold">Product Engineer</div>
              <div className="text-xs text-muted">Parcel &amp; Pine</div>
              <div className="pt-1 font-mono text-[11px] text-amber-ink">THU · 2:30 PM</div>
            </div>
            <div className={`flex flex-col gap-1.5 rounded-[14px] bg-card p-4 ${cardLift}`}>
              <div className="text-sm font-semibold">Data Analyst Intern</div>
              <div className="text-xs text-muted">Harbor Analytics</div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <span className="h-[9px] w-[9px] rounded-full bg-green" />Offer<span className="font-normal text-muted">1</span>
            </div>
            <div className={`flex flex-col gap-1.5 rounded-[14px] bg-ink p-4 text-paper ${cardLift}`}>
              <div className="text-sm font-semibold">Full-Stack Developer</div>
              <div className="text-xs text-fog">Copperline</div>
              <div className="pt-1 font-mono text-[11px] text-mint">RESPOND BY OCT 6</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- AI matching ---------- */}
      <section id="ai" className="grid grid-cols-1 items-center gap-16 px-6 py-28 lg:grid-cols-2 lg:px-20">
        <div className="flex flex-col gap-[18px] rounded-[28px] border border-line bg-card p-9">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Tailoring suggestions</div>
            <span className="font-mono text-[11px] text-muted">PREVIEW</span>
          </div>
          <div className="flex gap-3.5 rounded-[14px] bg-paper p-4">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-signal-soft text-[13px] font-bold text-signal">+</div>
            <div className="text-[15px] leading-normal">
              Mention <b>REST API design</b> — it appears 4 times in the posting but not in your résumé.
            </div>
          </div>
          <div className="flex gap-3.5 rounded-[14px] bg-paper p-4">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-soft text-[13px] font-bold text-amber-ink">↑</div>
            <div className="text-[15px] leading-normal">
              Move your <b>Supabase</b> project to the top of Experience; it matches their stack.
            </div>
          </div>
          <div className="flex gap-3.5 rounded-[14px] bg-paper p-4">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-green-soft text-[13px] font-bold text-green-ink">✓</div>
            <div className="text-[15px] leading-normal">Your bullet points use strong action verbs. Keep them.</div>
          </div>
        </div>
        <div className="flex flex-col gap-5">
          <div className="font-mono text-[13px] tracking-[0.08em] text-signal">AI MATCHING · IN DEVELOPMENT</div>
          <h2 className="font-display text-4xl font-bold leading-[1.02] tracking-[-0.04em] lg:text-[56px]">
            Know your fit before you apply.
          </h2>
          <p className="text-lg leading-[1.6] text-ink-2">
            Paste a job posting and JobMatch compares it to your résumé: which skills line up, which are missing, and how an applicant tracking system is likely to read it.
          </p>
        </div>
      </section>

      {/* ---------- Call to action ---------- */}
      <section className="mx-6 flex flex-col items-start justify-between gap-12 rounded-[32px] bg-ink bg-dots p-10 text-paper lg:mx-20 lg:flex-row lg:items-center lg:p-20">
        <h2 className="max-w-[720px] font-display text-4xl font-bold leading-none tracking-[-0.045em] lg:text-[64px]">
          Your next role is a pipeline away.
        </h2>
        <Link href="/signup" className={`shrink-0 rounded-full bg-paper px-8 py-5 text-lg font-semibold text-ink ${lift}`}>
          Create your account
        </Link>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="mt-24 flex flex-col justify-between gap-2 border-t border-line px-6 py-10 text-sm text-muted md:flex-row md:items-center lg:px-20">
        <div>JobMatch AI · Built by Bharath &amp; Ashraf</div>
        <div className="font-mono text-xs">MSCS 3999 Capstone · Clark University · Fall 2026</div>
      </footer>
    </div>
  );
}