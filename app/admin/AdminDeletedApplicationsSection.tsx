"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-client";

type DeletedRow = {
  deletedRecordId: string;
  originalApplicationId: string;
  applicationNumber: string;
  schoolId: string;
  schoolName: string | null;
  schoolSlug: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  programme: string | null;
  status: string;
  submittedAt: string;
  deletedAt: string;
  deletedBy: string;
  deletedByKind: string;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminDeletedApplicationsSection() {
  const [rows, setRows] = useState<DeletedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [restoreBusy, setRestoreBusy] = useState(false);

  const load = useCallback(async (asRefresh = false) => {
    try {
      if (asRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const res = await adminFetch("/api/admin/deleted-applications");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load deleted applications");
      setRows(Array.isArray(data.applications) ? data.applications : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load deleted applications.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = `${row.fullName} ${row.email} ${row.applicationNumber} ${row.schoolName || ""} ${row.schoolSlug || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const ids = filtered.map((r) => r.deletedRecordId);
      const all = ids.length > 0 && ids.every((id) => prev.has(id));
      return all ? new Set() : new Set(ids);
    });
  };

  const restoreSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const ok = window.confirm(
      `Restore ${ids.length} application${ids.length === 1 ? "" : "s"} to the partner school portal?`,
    );
    if (!ok) return;

    setRestoreBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await adminFetch("/api/admin/deleted-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Restore failed");
      setSelectedIds(new Set());
      setNotice(
        data.message ||
          `${data.restoredCount || 0} application(s) restored to their partner school.`,
      );
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        setError(data.errors.join(" · "));
      }
      void load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setRestoreBusy(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#0F172A]">
            Deleted applications backup
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[#64748B]">
            Partner school admins cannot retrieve deleted applicants themselves.
            Restore from here to send applications back to the school they were
            deleted from.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-[#334155] disabled:opacity-50"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, school, application ID…"
            className="w-full rounded-full border border-[#E5E7EB] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#007AFF]"
          />
        </div>
        {selectedIds.size > 0 ? (
          <button
            type="button"
            disabled={restoreBusy}
            onClick={() => void restoreSelected()}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#047857] px-4 py-2 text-sm font-semibold text-white hover:bg-[#065F46] disabled:opacity-50"
          >
            {restoreBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Restore ({selectedIds.size})
          </button>
        ) : null}
      </div>

      {notice ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-[#E5E7EB] bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-[#007AFF]" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={
                        filtered.length > 0 &&
                        filtered.every((r) =>
                          selectedIds.has(r.deletedRecordId),
                        )
                      }
                      onChange={toggleAll}
                      className="h-4 w-4 cursor-pointer rounded border-[#CBD5E1]"
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-4 py-3">Application</th>
                  <th className="px-4 py-3">Applicant</th>
                  <th className="px-4 py-3">School</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Deleted</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.deletedRecordId}
                    className={`border-t border-[#F3F4F6] ${
                      selectedIds.has(row.deletedRecordId)
                        ? "bg-emerald-50/50"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.deletedRecordId)}
                        onChange={() => toggleSelect(row.deletedRecordId)}
                        className="h-4 w-4 cursor-pointer rounded border-[#CBD5E1]"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {row.applicationNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.fullName}</div>
                      <div className="text-xs text-[#6B7280]">{row.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{row.schoolName || "Unknown school"}</div>
                      {row.schoolSlug ? (
                        <div className="text-xs text-[#6B7280]">
                          /admin/{row.schoolSlug}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3 text-xs text-[#6B7280]">
                      <div>{formatDate(row.deletedAt)}</div>
                      <div>
                        by {row.deletedBy}
                        {row.deletedByKind === "school_admin"
                          ? " (school)"
                          : " (platform)"}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-[#6B7280]"
                    >
                      <Trash2 className="mx-auto mb-2 h-6 w-6 text-[#CBD5E1]" />
                      No deleted applications in backup.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
