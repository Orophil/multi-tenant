"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login, superAdminLogin } from "@/lib/api";
import { getToken, setSession } from "@/lib/auth";

const SUPER_ADMIN_HINT = "superadmin@example.com";

type Mode = "org" | "super";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("org");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already authenticated, skip straight to the dashboard.
  useEffect(() => {
    if (getToken()) {
      router.replace("/dashboard");
    }
  }, [router]);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res =
        mode === "super"
          ? await superAdminLogin({ email: email.trim(), password })
          : await login({ email: email.trim(), password });
      setSession(res.token, res.user);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="center">
      <div className="card card-narrow">
        <h1>Feature Flags</h1>
        <p className="subtitle">Sign in to your account.</p>

        <div className="tabs">
          <button
            type="button"
            className={mode === "org" ? "active" : ""}
            onClick={() => switchMode("org")}
          >
            Organization user
          </button>
          <button
            type="button"
            className={mode === "super" ? "active" : ""}
            onClick={() => switchMode("super")}
          >
            Super Admin
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
            {mode === "super" && (
              <div className="hint">
                Default super admin: {SUPER_ADMIN_HINT}
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {mode === "org" && (
          <p className="switch-link">
            Need an account? <Link href="/signup">Sign up</Link>
          </p>
        )}
      </div>
    </div>
  );
}
