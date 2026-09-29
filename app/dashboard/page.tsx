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
    <div>
      <Nav email={data.user.email} />
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="font-display font-bold text-3xl mb-2">Welcome back</h1>
        <p className="text-ink-muted mb-8">
          Everything you're tracking lives in one place.
        </p>
                
        <a
          href="/tracker"
          className="inline-block bg-signal text-white rounded px-4 py-2 font-medium hover:opacity-90"
        >
          Open your tracker
        </a>
      </div>
    </div>
  );
}