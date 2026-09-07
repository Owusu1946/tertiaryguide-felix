"use client";

import { useCallback, useState } from "react";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function firstString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Best-effort display name from Ventra session JSON (shape not documented). */
function displayNameFromSession(session: unknown): string {
  if (!isRecord(session)) return "Signed in";

  const user = session.user;
  const data = session.data;

  const fromUser = isRecord(user) ? firstString(user.name, user.fullName, user.email) : null;
  const fromData = isRecord(data) ? firstString(data.name, data.fullName, data.email) : null;

  return (
    firstString(
      session.name,
      session.fullName,
      session.email,
      fromUser,
      fromData,
    ) ?? "Signed in (see raw session below)"
  );
}

function tokenFromLoginBody(data: unknown): string | null {
  if (!isRecord(data)) return null;
  const access = data.accessToken ?? data.token ?? data.access_token;
  return typeof access === "string" ? access : null;
}

export default function VentraSuperadminLoginTestPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [sessionJson, setSessionJson] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadSession = useCallback(async (bearer: string) => {
    const res = await fetch("/api/ventra-superadmin/session", {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    const body = await res.json();
    if (!res.ok) {
      setError(typeof body?.error === "string" ? body.error : JSON.stringify(body));
      setDisplayName(null);
      setSessionJson(null);
      return;
    }
    setError(null);
    setDisplayName(displayNameFromSession(body));
    setSessionJson(JSON.stringify(body, null, 2));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDisplayName(null);
    setSessionJson(null);
    setToken(null);
    setBusy(true);
    try {
      const res = await fetch("/api/ventra-superadmin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : JSON.stringify(data));
        return;
      }
      const t = tokenFromLoginBody(data);
      if (!t) {
        setError("Login OK but no accessToken in response.");
        setSessionJson(JSON.stringify(data, null, 2));
        return;
      }
      setToken(t);
      await loadSession(t);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await fetch("/api/ventra-superadmin/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: "{}",
      });
    } catch {
      setError("Logout request failed (token cleared locally).");
    } finally {
      setToken(null);
      setDisplayName(null);
      setSessionJson(null);
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Ventra superadmin — login test</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Proxies{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs">ventrapos.com</code> from the server
          so the browser avoids CORS. For local experiments only.
        </p>
      </div>

      <form
        onSubmit={handleLogin}
        className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">Email</span>
          <input
            type="email"
            autoComplete="email"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? "Working…" : "Sign in"}
        </button>
      </form>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {displayName ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950">
          <p className="text-sm font-medium text-emerald-900">Hello,</p>
          <p className="text-lg font-semibold">{displayName}</p>
          {token ? (
            <button
              type="button"
              onClick={handleLogout}
              disabled={busy}
              className="mt-3 text-sm font-medium text-emerald-800 underline-offset-2 hover:underline disabled:opacity-60"
            >
              Log out
            </button>
          ) : null}
        </div>
      ) : null}

      {sessionJson ? (
        <details className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-zinc-800">Raw session response</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs text-zinc-700">
            {sessionJson}
          </pre>
        </details>
      ) : null}
    </main>
  );
}
