import { serverDb } from "@/lib/supabase/server";
import { configured } from "@/lib/supabase/client";
import AdminLogin from "./login";
import Report from "./report";
import "./admin.css";

export default async function Admin({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const requested = Number((await searchParams).days);
  const days = [1, 7, 30, 90].includes(requested) ? requested : 30;
  if (!configured) return <AdminLogin />;
  const db = await serverDb();
  const { data: { user } } = await db.auth.getUser();
  if (!user || user.is_anonymous) return <AdminLogin />;
  const { data, error } = await db.rpc("platform_report", { days });
  if (error?.code === "42501") return <AdminLogin restricted />;
  if (error) return <main className="center"><h1>Report unavailable</h1><a href="/admin">Try again</a></main>;
  return <Report rows={data} days={days} />;
}
