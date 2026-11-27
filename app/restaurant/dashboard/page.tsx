import { redirect } from "next/navigation";
import { serverDb } from "@/lib/supabase/server";
import { configured } from "@/lib/supabase/client";
import Dashboard from "@/components/dashboard";
export default async function Page() {
  if (!configured)
    return (
      <main className="center">
        <h1>Connect your kitchen.</h1>
        <p>
          Add the two Supabase environment variables in .env.local, run
          supabase/setup.sql, then restart.
        </p>
        <a href="/">Back home</a>
      </main>
    );
  const db = await serverDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user || user.is_anonymous) redirect("/restaurant/login");
  return <Dashboard />;
}
