"use client";
import { BrandLogo } from "@/components/brand-mark";
import PasswordField from "@/components/password-field";

import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { configured, db } from "@/lib/supabase/client";

export default function AdminLogin({ restricted = false }: { restricted?: boolean }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      if (!configured) throw new Error("Admin sign-in is unavailable. Please contact the app administrator.");
      const { error } = await db().auth.signInWithPassword({
        email: String(form.get("email")).trim(),
        password: String(form.get("password")),
      });
      if (error) throw error;
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="login-layout">
      <section className="login-story">
        <a className="brand" href="/"><BrandLogo /></a>
        <h1>Platform <em>admin.</em></h1>
      </section>
      <section className="login-form">
        <h2>Admin sign in</h2>
        {restricted && <p role="alert" className="error">Your current account lacks platform admin access. Sign in with an admin account.</p>}
        <form onSubmit={signIn}>
          <label>
            Username (email)
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <PasswordField label="Password" name="password" autoComplete="current-password" required />
          {error && <p role="alert" className="error">{error}</p>}
          <button className="primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"} <ArrowRight size={18} />
          </button>
        </form>
        <a href="/restaurant/login">Restaurant staff sign in</a>
      </section>
    </main>
  );
}
