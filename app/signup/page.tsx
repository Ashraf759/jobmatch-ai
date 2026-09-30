"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import AuthShell, { ArrowIcon, authButtonClass, authInputClass } from "@/components/AuthShell";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <AuthShell mode="signup">
        <div className="flex flex-col gap-5">
          <div className="flex h-14 w-14 animate-pop items-center justify-center rounded-2xl bg-green-soft">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#155A43" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1 className="font-display text-5xl font-bold leading-none tracking-[-0.04em]">Account created.</h1>
          <p className="text-[17px] leading-normal text-ink-2">Sign in to start tracking.</p>
          <Link href="/login" className={authButtonClass}>
            Sign in
            <ArrowIcon />
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell mode="signup">
      <div className="flex flex-col gap-2.5">
        <h1 className="font-display text-5xl font-bold leading-none tracking-[-0.04em]">Start your search.</h1>
        <p className="text-[17px] leading-normal text-ink-2">
          Create a free account and add your first role in seconds.
        </p>
      </div>

      <form onSubmit={handleSignup} className="flex flex-col gap-[18px]">
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-semibold">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@clarku.edu"
            autoComplete="email"
            className={authInputClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-sm font-semibold">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="At least 6 characters"
            autoComplete="new-password"
            className={authInputClass}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-rust-soft px-4 py-3 text-sm text-rust-ink">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className={authButtonClass}>
          {loading ? "Creating account..." : "Create account"}
          {!loading && <ArrowIcon />}
        </button>
      </form>

      <p className="text-[13px] leading-normal text-muted">Your applications are private to your account.</p>
    </AuthShell>
  );
}