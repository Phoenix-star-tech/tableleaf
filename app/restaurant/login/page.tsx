"use client";
import PasswordField from "@/components/password-field";
import { useState } from "react";
import { Leaf, ArrowRight } from "lucide-react";
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
          <Leaf />
          tableleaf
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
            const { error } = await db().auth.signInWithPassword({
              email,
              password,
            });
            if (error) {
              setError(error.message);
              setBusy(false);
            } else {
              const destination = new URLSearchParams(location.search).get("next");
              location.href = destination === "admin" ? "/admin" : "/restaurant/dashboard";
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
