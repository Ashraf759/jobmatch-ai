"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Application = {
  id: string;
  company: string;
  role: string;
  status: string;
  date_applied: string;
  notes: string | null;
};

const STATUSES = ["applied", "interview", "offer", "rejected"];

export default function TrackerPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function loadApplications() {
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .order("date_applied", { ascending: false });

    if (!error && data) {
      setApplications(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    async function checkUserAndLoad() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }
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

  if (loading) return <p style={{ padding: 40 }}>Loading...</p>;

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", padding: 20 }}>
      <h1>Job Application Tracker</h1>

      <form
        onSubmit={handleAdd}
        style={{ display: "flex", gap: 8, marginBottom: 24 }}
      >
        <input
          placeholder="Company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          required
          style={{ flex: 1, padding: 8 }}
        />
        <input
          placeholder="Role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          required
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit" style={{ padding: 8 }}>
          Add
        </button>
      </form>

      {applications.length === 0 && <p>No applications yet.</p>}

      {applications.map((app) => (
        <div
          key={app.id}
          style={{
            border: "1px solid #ccc",
            borderRadius: 6,
            padding: 12,
            marginBottom: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <strong>{app.company}</strong> — {app.role}
            <div style={{ fontSize: 12, color: "#888" }}>
              Applied {app.date_applied}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              value={app.status}
              onChange={(e) => handleStatusChange(app.id, e.target.value)}
              style={{ padding: 4 }}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button onClick={() => handleDelete(app.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}