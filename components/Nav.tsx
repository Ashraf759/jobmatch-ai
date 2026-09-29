"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function Nav({ email }: { email?: string }) {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <nav className="border-b border-line px-6 py-4 flex items-center justify-between">
      <a href="/dashboard" className="font-display font-bold text-lg">
        JobMatch AI
      </a>
      <div className="flex items-center gap-6 text-sm">
        <a href="/tracker" className="text-ink-muted hover:text-ink">
          Tracker
        </a>
        {email && <span className="text-ink-muted">{email}</span>}
        <button
          onClick={handleSignOut}
          className="text-ink-muted hover:text-ink"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}