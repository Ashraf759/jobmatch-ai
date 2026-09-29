"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Nav from "@/components/Nav";

type Application = {
  id: string;
  company: string;
  role: string;
  status: string;
  date_applied: string;
};

const STATUSES = [
  { value: "applied", label: "Applied", color: "border-applied text-applied" },
  { value: "interview", label: "Interview", color: "border-signal text-signal" },
  { value: "offer", label: "Offer", color: "border-offer text-offer" },
  { value: "rejected", label: "Rejected", color: "border-rejected text-rejected" },
];

const STRIPE: Record<string, string> = {
  applied: "border-l-applied",
  interview: "border-l-signal",
  offer: "border-l-offer",
  rejected: "border-l-rejected",
};

export default function TrackerPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState<string | undefined>();
  const router = useRouter();
  const supabase = createClient();

  async function loadApplications() {
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .order("date_applied", { ascending: false });

    if (!error && data) setApplications(data);
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
      loadApplications();
    }
    checkUserAndLoad();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    await supabase.from("applications").insert({
      company,
      role,
      user_id: data.user.id,
    });

    setCompany("");
    setRole("");
    loadApplications();
  }

  async function handleStatusChange(id: string, status: string) {
    await supabase.from("applications").update({ status }).eq("id", id);
    loadApplications();
  }

  async function handleDelete(id: string) {
    await supabase.from("applications").delete().eq("id", id);
    loadApplications();
  }

  if (loading) return <p className="p-10 text-ink-muted">Loading...</p>;

  const counts = {
    total: applications.length,
    applied: applications.filter((a) => a.status === "applied").length,
    interview: applications.filter((a) => a.status === "interview").length,
    offer: applications.filter((a) => a.status === "offer").length,
  };

  return (
    <div>
      <Nav email={email} />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="font-display font-bold text-2xl mb-1">Applications</h1>
        <p className="text-ink-muted text-sm mb-6">
          {counts.total} tracked · {counts.applied} applied · {counts.interview} interviewing · {counts.offer} offers
        </p>

        <form onSubmit={handleAdd} className="flex gap-2 mb-8">
          <input
            placeholder="Company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            required
            className="flex-1 border border-line rounded px-3 py-2 bg-white focus:outline-2 focus:outline-signal"
          />
          <input
            placeholder="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
            className="flex-1 border border-line rounded px-3 py-2 bg-white focus:outline-2 focus:outline-signal"
          />
          <button
            type="submit"
            className="bg-signal text-white rounded px-4 py-2 font-medium hover:opacity-90"
          >
            Add
          </button>
        </form>

        {applications.length === 0 && (
          <p className="text-ink-muted text-sm">
            Nothing tracked yet. Add your first application above.
          </p>
        )}

        <div className="space-y-3">
          {applications.map((app) => (
            <div
              key={app.id}
              className={`border border-line ${STRIPE[app.status]} border-l-4 rounded px-4 py-3 flex items-center justify-between bg-white`}
            >
              <div>
                <p className="font-display font-semibold">{app.company}</p>
                <p className="text-sm text-ink-muted">
                  {app.role} · Applied {app.date_applied}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {STATUSES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => handleStatusChange(app.id, s.value)}
                      className={`text-xs px-2 py-1 rounded border ${
                        app.status === s.value
                          ? s.color
                          : "border-line text-ink-muted"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => handleDelete(app.id)}
                  className="text-xs text-ink-muted hover:text-rejected ml-2"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}