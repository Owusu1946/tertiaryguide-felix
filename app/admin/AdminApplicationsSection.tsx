"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-client";
import { ApplicationDocuments } from "@/app/components/ApplicationDocuments";
import {
  studentStatusBadgeClass,
  studentStatusCopy,
} from "@/lib/admissions/status-messages";
import { APPLICATION_STATUSES } from "@/lib/admissions/types";

type AdminApplicationRow = {
  id: string;
  applicationNumber: string;
  schoolId: string;
  schoolName: string;
  schoolSlug: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  programme: string | null;
  status: string;
  submittedAt: string;
  documents?: Record<string, string | undefined> | null;
};

type SchoolTab = {
  schoolId: string;
  schoolName: string;
  schoolSlug: string | null;
  count: number;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function schoolTabClass(active: boolean) {
  return active
    ? "bg-[#007AFF] text-white shadow-sm shadow-[#007AFF]/20"
    : "bg-white text-[#555555] ring-1 ring-gray-200 hover:bg-gray-50 hover:text-[#007AFF]";
}

export function AdminApplicationsSection() {
  const [rows, setRows] = useState<AdminApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminApplicationRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async (asRefresh = false) => {
    try {
      if (asRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const res = await adminFetch("/api/admin/applications");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load applications");
      setRows(Array.isArray(data.applications) ? data.applications : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load applications.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const normalizedQuery = query.trim().toLowerCase();

  const schoolKey = (row: AdminApplicationRow) =>
    row.schoolId || row.schoolName || "unknown";

  const studentMatchesQuery = useCallback(
    (row: AdminApplicationRow, q: string) => {
      if (!q) return true;
      const hay =
        `${row.fullName} ${row.email} ${row.phone ?? ""} ${row.applicationNumber} ${row.programme ?? ""}`.toLowerCase();
      return hay.includes(q);
    },
    [],
  );

  const schoolTabs = useMemo<SchoolTab[]>(() => {
    const map = new Map<string, SchoolTab>();
    for (const row of rows) {
      const key = schoolKey(row);
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          schoolId: key,
          schoolName: row.schoolName || "Unknown school",
          schoolSlug: row.schoolSlug,
          count: 1,
        });
      }
    }
    return [...map.values()].sort((a, b) =>
      a.schoolName.localeCompare(b.schoolName, undefined, {
        sensitivity: "base",
      }),
    );
  }, [rows]);

  const visibleSchoolTabs = useMemo(() => {
    if (!normalizedQuery) return schoolTabs;
    return schoolTabs.filter((tab) => {
      if (tab.schoolName.toLowerCase().includes(normalizedQuery)) return true;
      return rows.some(
        (row) =>
          schoolKey(row) === tab.schoolId &&
          studentMatchesQuery(row, normalizedQuery),
      );
    });
  }, [normalizedQuery, rows, schoolTabs, studentMatchesQuery]);

  useEffect(() => {
    if (visibleSchoolTabs.length === 0) {
      if (!normalizedQuery) setActiveSchoolId(null);
      return;
    }
    if (
      !activeSchoolId ||
      !visibleSchoolTabs.some((tab) => tab.schoolId === activeSchoolId)
    ) {
      setActiveSchoolId(visibleSchoolTabs[0].schoolId);
    }
  }, [activeSchoolId, normalizedQuery, visibleSchoolTabs]);

  const activeSchool = useMemo(
    () =>
      visibleSchoolTabs.find((tab) => tab.schoolId === activeSchoolId) ||
      schoolTabs.find((tab) => tab.schoolId === activeSchoolId) ||
      null,
    [activeSchoolId, schoolTabs, visibleSchoolTabs],
  );

  const schoolNameMatched = Boolean(
    activeSchool &&
      normalizedQuery &&
      activeSchool.schoolName.toLowerCase().includes(normalizedQuery),
  );

  const schoolRows = useMemo(() => {
    if (!activeSchoolId) return [];
    return rows.filter((row) => schoolKey(row) === activeSchoolId);
  }, [activeSchoolId, rows]);

  const filtered = useMemo(() => {
    return schoolRows.filter((row) => {
      const matchesStatus = status === "All" || row.status === status;
      if (!matchesStatus) return false;
      if (!normalizedQuery) return true;
      if (schoolNameMatched) return true;
      return studentMatchesQuery(row, normalizedQuery);
    });
  }, [
    normalizedQuery,
    schoolNameMatched,
    schoolRows,
    status,
    studentMatchesQuery,
  ]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const ids = filtered.map((row) => row.id);
      const allSelected =
        ids.length > 0 && ids.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(ids);
    });
  };

  const selectSchool = (schoolId: string) => {
    setActiveSchoolId(schoolId);
    setSelectedIds(new Set());
    setSelected(null);
    setNotice(null);
  };

  const deleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const ok = window.confirm(
      `Delete ${ids.length} application${ids.length === 1 ? "" : "s"}?\n\nThey will move to Deleted apps and can be restored later.`,
    );
    if (!ok) return;

    setDeleteBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await adminFetch("/api/admin/applications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete applications");
      setSelectedIds(new Set());
      if (selected && ids.includes(selected.id)) setSelected(null);
      setNotice(
        data.message ||
          "Applications removed. Restore them from Deleted apps if needed.",
      );
      await load(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete applications.",
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  const deleteOne = async (row: AdminApplicationRow) => {
    const ok = window.confirm(
      `Delete application ${row.applicationNumber} for ${row.fullName}?\n\nIt will move to Deleted apps and can be restored later.`,
    );
    if (!ok) return;

    setDeleteBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await adminFetch("/api/admin/applications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [row.id] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete application");
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
      if (selected?.id === row.id) setSelected(null);
      setNotice(data.message || "Application moved to Deleted apps.");
      await load(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete application.",
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((row) => selectedIds.has(row.id));

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-[#DBEAFE] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#111827]">Applications</h2>
            <p className="mt-1 text-sm text-[#6B7280]">
              Choose a school tab to review its applicants.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedIds.size > 0 ? (
              <button
                type="button"
                onClick={() => void deleteSelected()}
                disabled={deleteBusy}
                className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
              >
                {deleteBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Delete selected ({selectedIds.size})
              </button>
            ) : null}
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
        </div>

        {notice ? (
          <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {notice}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search schools or student names"
              className="w-full rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] py-2.5 pl-9 pr-10 text-sm outline-none focus:border-[#007AFF] focus:bg-white"
              aria-label="Search schools or student names"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-[#9CA3AF] hover:bg-gray-100 hover:text-[#374151]"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#007AFF]"
          >
            <option value="All">All statuses</option>
            {APPLICATION_STATUSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        {normalizedQuery ? (
          <p className="mt-2 text-xs text-[#6B7280]">
            {visibleSchoolTabs.length} school
            {visibleSchoolTabs.length === 1 ? "" : "s"} · {filtered.length}{" "}
            applicant{filtered.length === 1 ? "" : "s"} in the selected school
          </p>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#007AFF]" />
          </div>
        ) : error ? (
          <p className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : schoolTabs.length === 0 ? (
          <div className="mt-8 flex flex-col items-center py-12 text-center">
            <GraduationCap className="h-8 w-8 text-[#007AFF]/50" />
            <p className="mt-3 text-sm font-medium text-[#374151]">
              No applications found
            </p>
          </div>
        ) : visibleSchoolTabs.length === 0 ? (
          <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-[#E5E7EB] bg-[#F8FAFC] py-12 text-center">
            <Search className="h-8 w-8 text-[#007AFF]/50" />
            <p className="mt-3 text-sm font-medium text-[#374151]">
              No schools or students match “{query.trim()}”
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-3 text-xs font-semibold text-[#007AFF] hover:underline"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <nav
              className="rounded-2xl border border-gray-100 bg-white p-2 shadow-sm"
              aria-label="School applications"
            >
              <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {visibleSchoolTabs.map((tab) => {
                  const active = tab.schoolId === activeSchoolId;
                  const matchCount = normalizedQuery
                    ? rows.filter(
                        (row) =>
                          schoolKey(row) === tab.schoolId &&
                          (tab.schoolName
                            .toLowerCase()
                            .includes(normalizedQuery) ||
                            studentMatchesQuery(row, normalizedQuery)),
                      ).length
                    : tab.count;
                  return (
                    <button
                      key={tab.schoolId}
                      type="button"
                      onClick={() => selectSchool(tab.schoolId)}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition active:scale-[0.98] ${schoolTabClass(active)}`}
                    >
                      <span>{tab.schoolName}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          active
                            ? "bg-white/20 text-white"
                            : "bg-gray-100 text-[#6B7280]"
                        }`}
                      >
                        {matchCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>

            {activeSchool ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[#0F172A]">
                    {activeSchool.schoolName}
                  </h3>
                  <p className="text-xs text-[#6B7280]">
                    {filtered.length} applicant
                    {filtered.length === 1 ? "" : "s"}
                    {normalizedQuery || status !== "All"
                      ? " matching your search"
                      : ""}
                  </p>
                </div>
                {activeSchool.schoolSlug ? (
                  <Link
                    href={`/admin/${encodeURIComponent(activeSchool.schoolSlug)}?tab=applicants`}
                    className="inline-flex rounded-full border border-[#BFDBFE] bg-white px-3 py-1.5 text-xs font-semibold text-[#007AFF] hover:bg-[#EFF6FF]"
                  >
                    Open school portal
                  </Link>
                ) : null}
              </div>
            ) : null}

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#E5E7EB] bg-[#F8FAFC] py-12 text-center">
                <GraduationCap className="h-8 w-8 text-[#007AFF]/50" />
                <p className="mt-3 text-sm font-medium text-[#374151]">
                  No applicants match for this school
                </p>
                <p className="mt-1 text-xs text-[#6B7280]">
                  Try another school tab or clear your search.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[#E5E7EB]">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[#F8FAFC] text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      <tr className="border-b border-[#E5E7EB]">
                        <th className="w-10 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={toggleSelectAllVisible}
                            className="h-4 w-4 rounded border-[#CBD5E1] text-[#007AFF]"
                            aria-label="Select all visible applicants"
                          />
                        </th>
                        <th className="py-3 pr-4">Applicant</th>
                        <th className="py-3 pr-4">Programme</th>
                        <th className="py-3 pr-4">Status</th>
                        <th className="py-3 pr-4">Submitted</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-[#F3F4F6] last:border-0"
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(row.id)}
                              onChange={() => toggleSelect(row.id)}
                              className="h-4 w-4 rounded border-[#CBD5E1] text-[#007AFF]"
                              aria-label={`Select ${row.fullName}`}
                            />
                          </td>
                          <td className="py-3 pr-4">
                            <p className="font-medium text-[#111827]">
                              {row.fullName}
                            </p>
                            <p className="text-xs text-[#6B7280]">
                              {row.applicationNumber}
                            </p>
                          </td>
                          <td className="py-3 pr-4 text-[#374151]">
                            {row.programme || "—"}
                          </td>
                          <td className="py-3 pr-4">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${studentStatusBadgeClass(row.status)}`}
                            >
                              {studentStatusCopy(row.status).badge}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-[#6B7280]">
                            {formatDate(row.submittedAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setSelected(row)}
                                className="text-xs font-semibold text-[#007AFF] hover:underline"
                              >
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteOne(row)}
                                disabled={deleteBusy}
                                className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selected && (
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
                <h3 className="font-semibold text-[#111827]">
                  {selected.fullName}
                </h3>
                <p className="text-xs text-[#6B7280]">
                  {selected.applicationNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-sm text-[#6B7280]"
              >
                Close
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
              <p>
                <strong>School:</strong> {selected.schoolName}
              </p>
              <p>
                <strong>Email:</strong> {selected.email}
              </p>
              <p>
                <strong>Phone:</strong> {selected.phone || "—"}
              </p>
              <p>
                <strong>Programme:</strong> {selected.programme || "—"}
              </p>
              <p>
                <strong>Status:</strong>{" "}
                {studentStatusCopy(selected.status).badge}
              </p>
              <ApplicationDocuments
                documents={selected.documents}
                applicationNumber={selected.applicationNumber}
              />
              <div className="flex flex-wrap gap-2 pt-2">
                {selected.schoolSlug ? (
                  <Link
                    href={`/admin/${encodeURIComponent(selected.schoolSlug)}?tab=applicants`}
                    className="inline-flex rounded-full bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0062CC]"
                  >
                    Open school portal
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => void deleteOne(selected)}
                  disabled={deleteBusy}
                  className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete application
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
