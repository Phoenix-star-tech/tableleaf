"use client";
import { BrandLogo } from "@/components/brand-mark";
import PasswordField from "@/components/password-field";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { db, configured } from "@/lib/supabase/client";
export default function Login() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="login-layout">
      <section className="login-story">
        <a href="/" className="brand">
          <BrandLogo />
        </a>
        <p className="eyebrow">LESS ADMIN. MORE HOSPITALITY.</p>
        <h1>
          Your kitchen.
          <br />
          In <em>harmony.</em>
        </h1>
        <p className="lead">
          Every table, every order, every happy guest.
          <br />
          One calm place to run it all.
        </p>
        <div className="dish-art">🥬</div>
      </section>
      <section className="login-form">
        <p className="eyebrow">THE RESTAURANT DESK</p>
        <h2>Welcome back.</h2>
        <p className="muted">Sign in to get your service started.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            if (!configured) {
              setError(
                "Configure Supabase in .env.local first. See README.md.",
              );
              setBusy(false);
              return;
            }
            try {
              const client = db();
              const { data, error } = await client.auth.signInWithPassword({
                email: email.trim(),
                password,
              });
              if (error) throw error;
              const destination = new URLSearchParams(location.search).get("next");
              if (destination === "admin") {
                location.href = "/admin";
                return;
              }
              const [owned, assigned] = await Promise.all([
                client.from("restaurants").select("id").eq("owner_id", data.user.id).limit(1),
                client.from("staff").select("restaurants!inner(id)").eq("user_id", data.user.id).limit(1),
              ]);
              if (owned.error || assigned.error) throw new Error("Couldn’t check your restaurant. Please try again.");
              if (!owned.data?.length && !assigned.data?.length) {
                throw new Error("No restaurant is linked to this login. Use Create your restaurant below, or ask your restaurant owner to add you as staff.");
              }
              location.href = "/restaurant/dashboard";
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Couldn’t sign in. Please try again.");
              setBusy(false);
            }
          }}
        >
          <label>
            Email address
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@restaurant.com"
            />
          </label>
            <PasswordField
              label="Password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Signing in…" : "Open my dashboard"}
            <ArrowRight size={18} />
          </button>
        </form>
        <p className="small muted" style={{ marginTop: 20 }}>
          Don&apos;t have an account?{" "}
          <a
            href="/restaurant/signup"
            style={{ color: "var(--accent)", fontWeight: 600 }}
          >
            Create your restaurant →
          </a>
        </p>
      </section>
    </main>
  );
}
