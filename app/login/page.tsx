"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import AuthShell, { ArrowIcon, authButtonClass, authInputClass } from "@/components/AuthShell";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <AuthShell mode="login">
      <div className="flex flex-col gap-2.5">
        <h1 className="font-display text-5xl font-bold leading-none tracking-[-0.04em]">Welcome back.</h1>
        <p className="text-[17px] leading-normal text-ink-2">Sign in to see your pipeline.</p>
      </div>

      <form onSubmit={handleLogin} className="flex flex-col gap-[18px]">
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
            placeholder="Your password"
            autoComplete="current-password"
            className={authInputClass}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-rust-soft px-4 py-3 text-sm text-rust-ink">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className={authButtonClass}>
          {loading ? "Signing in..." : "Sign in"}
          {!loading && <ArrowIcon />}
        </button>
      </form>

      <p className="text-[13px] leading-normal text-muted">Your applications are private to your account.</p>
    </AuthShell>
  );
}