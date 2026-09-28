import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login");
  }

  return (
    <div style={{ maxWidth: 400, margin: "80px auto" }}>
      <h1>Dashboard</h1>
      <p>Logged in as {data.user.email}</p>
    </div>
  );
}