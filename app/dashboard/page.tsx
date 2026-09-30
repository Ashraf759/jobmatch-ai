import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Nav from "@/components/Nav";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper font-body text-ink lg:flex-row">
      <Nav email={data.user.email} active="dashboard" />

      <main className="flex min-w-0 flex-1 flex-col gap-8 px-6 py-9 lg:px-10">
        <div className="flex animate-fade-up flex-col gap-1.5">
          <div className="font-mono text-xs tracking-[0.1em] text-muted">DASHBOARD</div>
          <h1 className="font-display text-[44px] font-bold leading-none tracking-[-0.04em]">Welcome back.</h1>
          <p className="pt-1 text-[17px] text-ink-2">Everything you’re tracking lives in one place.</p>
        </div>

        <section className="flex animate-fade-up flex-col items-start justify-between gap-8 rounded-[28px] bg-ink bg-dots p-10 text-paper [animation-delay:120ms] md:flex-row md:items-end">
          <div className="flex max-w-[520px] flex-col gap-3">
            <div className="font-mono text-xs tracking-[0.1em] text-signal-glow">YOUR PIPELINE</div>
            <h2 className="font-display text-4xl font-bold leading-[1.02] tracking-[-0.04em] lg:text-[48px]">
              Every application, one clear board.
            </h2>
            <p className="text-base leading-normal text-fog">
              Add roles, move them forward, and see where each one stands.
            </p>
          </div>
          <Link
            href="/tracker"
            className="inline-flex shrink-0 items-center gap-2.5 rounded-full bg-paper px-7 py-4 text-base font-semibold text-ink transition hover:-translate-y-0.5"
          >
            Open your tracker
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </section>

        <div className="grid animate-fade-up grid-cols-1 gap-5 [animation-delay:240ms] md:grid-cols-2">
          <article className="flex flex-col gap-4 rounded-3xl border border-line bg-card p-8">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-signal-soft text-signal">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                  <path d="M14 3v5h5M9 13h6M9 17h4" />
                </svg>
              </div>
              <span className="rounded-md border border-line px-2 py-1 font-mono text-[11px] text-muted">COMING SOON</span>
            </div>
            <h3 className="font-display text-2xl font-bold tracking-[-0.02em]">Résumés</h3>
            <p className="text-[15px] leading-[1.55] text-ink-2">
              Upload your résumé once and keep versions for different kinds of roles.
            </p>
          </article>

          <article className="flex flex-col gap-4 rounded-3xl border border-line bg-card p-8">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-soft text-amber-ink">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="9" cy="12" r="5" />
                  <circle cx="15" cy="12" r="5" />
                </svg>
              </div>
              <span className="rounded-md border border-line px-2 py-1 font-mono text-[11px] text-muted">COMING SOON</span>
            </div>
            <h3 className="font-display text-2xl font-bold tracking-[-0.02em]">AI Match</h3>
            <p className="text-[15px] leading-[1.55] text-ink-2">
              Score your résumé against a job posting and see which skills to add before you apply.
            </p>
          </article>
        </div>
      </main>
    </div>
  );
}