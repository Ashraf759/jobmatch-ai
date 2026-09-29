"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

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
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-display font-bold text-2xl mb-2">Account created</h1>
          <p className="text-ink-muted">
            <a href="/login" className="text-signal">Log in</a> to start tracking.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-display font-bold text-2xl mb-1">Create an account</h1>
        <p className="text-ink-muted text-sm mb-6">
          Start tracking applications in one place.
        </p>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-line rounded px-3 py-2 bg-white focus:outline-2 focus:outline-signal"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full border border-line rounded px-3 py-2 bg-white focus:outline-2 focus:outline-signal"
            />
          </div>

          {error && <p className="text-rejected text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-signal text-white rounded py-2 font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <p className="text-sm text-ink-muted mt-6">
          Already have an account? <a href="/login" className="text-signal">Log in</a>
        </p>
      </div>
    </div>
  );
}