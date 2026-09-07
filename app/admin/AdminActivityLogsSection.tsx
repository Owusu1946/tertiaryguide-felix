"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Activity,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-client";

type ActivityLogRow = {
  id: string;
  createdAt: string;
  action: string;
  surface: string;
  severity: string;
  actorKind: string;
  actorUsername: string | null;
  actorEmail: string | null;
  schoolName: string | null;
  schoolSlug: string | null;
  summary: string;
  ip: string | null;
  userAgent: string | null;
  path: string | null;
  success: boolean;
  meta: Record<string, unknown> | null;
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function severityClass(severity: string) {
  if (severity === "security") return "bg-red-50 text-red-700 ring-red-200";
  if (severity === "warning") return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-sky-50 text-sky-700 ring-sky-200";
}

function surfaceLabel(surface: string) {
  if (surface === "partner_school") return "Partner school";
  if (surface === "admin") return "TG admin";
  if (surface === "user") return "User";
  if (surface === "public") return "Public";
  return surface;
}

export function AdminActivityLogsSection() {
  const [rows, setRows] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [surface, setSurface] = useState("All");
  const [severity, setSeverity] = useState("All");
  const [success, setSuccess] = useState("All");
  const [selected, setSelected] = useState<ActivityLogRow | null>(null);

  const load = useCallback(
    async (asRefresh = false) => {
      try {
        if (asRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        if (surface !== "All") params.set("surface", surface);
        if (severity !== "All") params.set("severity", severity);
        if (success === "ok") params.set("success", "true");
        if (success === "failed") params.set("success", "false");
        params.set("limit", "200");

        const res = await adminFetch(
          `/api/admin/activity-logs?${params.toString()}`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load logs");
        setRows(Array.isArray(data.logs) ? data.logs : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load logs.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [query, severity, success, surface],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="rounded-3xl border border-[#DBEAFE] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#111827]">Activity logs</h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            Track logins, admin actions, partner school activity, and user
            events — including failed attempts for security review.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#BFDBFE] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-[#EFF6FF] disabled:opacity-60"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search username, email, school, IP, action…"
            className="w-full rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#007AFF] focus:bg-white"
          />
        </label>
        <select
          value={surface}
          onChange={(e) => setSurface(e.target.value)}
          className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#007AFF]"
        >
          <option value="All">All surfaces</option>
          <option value="user">Users</option>
          <option value="admin">TG admin</option>
          <option value="partner_school">Partner schools</option>
          <option value="public">Public</option>
          <option value="system">System</option>
        </select>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#007AFF]"
        >
          <option value="All">All severities</option>
          <option value="security">Security</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <select
          value={success}
          onChange={(e) => setSuccess(e.target.value)}
          className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#007AFF] sm:col-span-2 lg:col-span-1"
        >
          <option value="All">Success + failed</option>
          <option value="ok">Successful only</option>
          <option value="failed">Failed only</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#007AFF]" />
        </div>
      ) : error ? (
        <p className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : rows.length === 0 ? (
        <div className="mt-8 flex flex-col items-center py-12 text-center">
          <Activity className="h-8 w-8 text-[#007AFF]/50" />
          <p className="mt-3 text-sm font-medium text-[#374151]">
            No activity logs yet
          </p>
          <p className="mt-1 text-xs text-[#6B7280]">
            New logins and platform actions will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-2xl border border-[#E5E7EB]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F8FAFC] text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                <tr className="border-b border-[#E5E7EB]">
                  <th className="px-4 py-3">When</th>
                  <th className="py-3 pr-4">Actor</th>
                  <th className="py-3 pr-4">Surface</th>
                  <th className="py-3 pr-4">Event</th>
                  <th className="py-3 pr-4">IP</th>
                  <th className="px-4 py-3 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[#F3F4F6] last:border-0"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[#6B7280]">
                      {formatWhen(row.createdAt)}
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-[#111827]">
                        {row.actorUsername || row.actorEmail || "Anonymous"}
                      </p>
                      <p className="text-xs text-[#6B7280]">
                        {row.actorKind}
                        {row.schoolName ? ` · ${row.schoolName}` : ""}
                      </p>
                    </td>
                    <td className="py-3 pr-4 text-[#374151]">
                      {surfaceLabel(row.surface)}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${severityClass(row.severity)}`}
                        >
                          {row.severity}
                        </span>
                        {!row.success ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700 ring-1 ring-red-200">
                            <ShieldAlert className="h-3 w-3" />
                            Failed
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-[#111827]">{row.summary}</p>
                      <p className="text-[11px] text-[#9CA3AF]">{row.action}</p>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-[#6B7280]">
                      {row.ip || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(row)}
                        className="text-xs font-semibold text-[#007AFF] hover:underline"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
          <button
            type="button"
            className="h-full flex-1"
            aria-label="Close"
            onClick={() => setSelected(null)}
          />
          <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="font-semibold text-[#111827]">Log details</h3>
                <p className="text-xs text-[#6B7280]">{selected.action}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-sm text-[#6B7280]"
              >
                Close
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm">
              <p>
                <strong>When:</strong> {formatWhen(selected.createdAt)}
              </p>
              <p>
                <strong>Summary:</strong> {selected.summary}
              </p>
              <p>
                <strong>Actor:</strong>{" "}
                {selected.actorUsername || selected.actorEmail || "Anonymous"} (
                {selected.actorKind})
              </p>
              <p>
                <strong>Surface:</strong> {surfaceLabel(selected.surface)}
              </p>
              <p>
                <strong>Severity:</strong> {selected.severity}
              </p>
              <p>
                <strong>Result:</strong>{" "}
                {selected.success ? "Success" : "Failed"}
              </p>
              <p>
                <strong>School:</strong>{" "}
                {selected.schoolName || selected.schoolSlug || "—"}
              </p>
              <p>
                <strong>IP:</strong> {selected.ip || "—"}
              </p>
              <p>
                <strong>Path:</strong> {selected.path || "—"}
              </p>
              <p className="break-all">
                <strong>User agent:</strong> {selected.userAgent || "—"}
              </p>
              {selected.meta ? (
                <pre className="overflow-x-auto rounded-xl bg-[#F8FAFC] p-3 text-xs text-[#374151]">
                  {JSON.stringify(selected.meta, null, 2)}
                </pre>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
