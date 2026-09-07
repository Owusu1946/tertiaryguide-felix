"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  DatabaseZap,
  GraduationCap,
  KeyRound,
  ScrollText,
  Shield,
  TriangleAlert,
} from "lucide-react";
import { PasswordInput } from "@/app/components/PasswordInput";
import { adminFetch } from "@/lib/admin-client";
import { AdminApplicationsSection } from "./AdminApplicationsSection";
import { AdminDeletedApplicationsSection } from "./AdminDeletedApplicationsSection";
import { AdminActivityLogsSection } from "./AdminActivityLogsSection";

const RESET_CONFIRMATION_PHRASE = "RESET";

export type SettingsTab =
  | "account"
  | "applications"
  | "deletedApplications"
  | "activityLogs";

type AdminSettingsSectionProps = {
  adminName: string;
  adminRole?: "admin" | "superadmin" | null;
  activeTab?: SettingsTab;
  onTabChange?: (tab: SettingsTab) => void;
};

function tabClass(active: boolean) {
  return active
    ? "bg-[#007AFF] text-white shadow-sm shadow-[#007AFF]/20"
    : "bg-white text-[#555555] ring-1 ring-gray-200 hover:bg-gray-50 hover:text-[#007AFF]";
}

export function AdminSettingsSection({
  adminName,
  adminRole,
  activeTab,
  onTabChange,
}: AdminSettingsSectionProps) {
  const [internalTab, setInternalTab] = useState<SettingsTab>(
    activeTab || "account",
  );
  const tab = activeTab ?? internalTab;

  useEffect(() => {
    if (activeTab) setInternalTab(activeTab);
  }, [activeTab]);

  const setTab = (next: SettingsTab) => {
    setInternalTab(next);
    onTabChange?.(next);
  };

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetPhrase, setResetPhrase] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const resetConfirmed =
    resetPhrase.trim() === RESET_CONFIRMATION_PHRASE &&
    resetPassword.length > 0;

  function closeResetModal() {
    if (resetting) return;
    setResetOpen(false);
    setResetPhrase("");
    setResetPassword("");
    setResetError(null);
  }

  const handleResetDatabase = async () => {
    if (!resetConfirmed || resetting) return;

    try {
      setResetting(true);
      setResetError(null);
      const res = await adminFetch("/api/admin/reset-database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: resetPassword,
          confirmation: resetPhrase.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setResetError(data.error || "Failed to reset the database.");
        return;
      }

      setResetOpen(false);
      setResetPhrase("");
      setResetPassword("");
      setToast(
        `Database reset. ${data.deletedTotal ?? 0} records were removed.`,
      );
      setTimeout(() => setToast(null), 4000);
    } catch {
      setResetError("Something went wrong. Please try again.");
    } finally {
      setResetting(false);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please fill in all password fields.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: adminName,
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to change password.");
        return;
      }

      setToast("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setToast(null), 2500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const settingsTabs: {
    id: SettingsTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: "account", label: "Account", icon: KeyRound },
    { id: "applications", label: "Applications", icon: GraduationCap },
    { id: "deletedApplications", label: "Deleted apps", icon: AlertTriangle },
    { id: "activityLogs", label: "Activity logs", icon: ScrollText },
  ];

  return (
    <>
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-[#111827] px-4 py-3 text-sm text-white shadow-lg">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#2563EB] text-xs font-semibold">
              ✓
            </span>
            <span>{toast}</span>
          </div>
        </div>
      )}

      <section className="space-y-1 rounded-3xl border border-[#DBEAFE] bg-gradient-to-r from-[#F4FAFF] to-white px-5 py-5 shadow-sm">
        <p className="text-xs font-medium text-[#9CA3AF]">
          Dashboard / <span className="text-[#111827]">Settings</span>
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#007AFF] md:text-3xl">
          Settings
        </h1>
        <p className="text-sm text-[#6B7280]">
          Account security, partner applications, deleted apps, and platform
          activity logs.
        </p>
      </section>

      <nav
        className="mt-5 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm"
        aria-label="Settings sections"
      >
        <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {settingsTabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition active:scale-[0.98] ${tabClass(active)}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="mt-6">
        {tab === "applications" ? (
          <AdminApplicationsSection />
        ) : tab === "deletedApplications" ? (
          <AdminDeletedApplicationsSection />
        ) : tab === "activityLogs" ? (
          <AdminActivityLogsSection />
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <article className="rounded-3xl border border-[#DBEAFE] bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#007AFF]">
                    <KeyRound className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-[#111827]">
                      Change password
                    </h2>
                    <p className="mt-1 text-sm text-[#6B7280]">
                      Signed in as{" "}
                      <span className="font-medium text-[#111827]">
                        {adminName}
                      </span>
                      {adminRole === "superadmin"
                        ? " · Superadmin"
                        : " · Admin"}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 md:max-w-md">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#374151]">
                      Current password
                    </label>
                    <PasswordInput
                      id="admin-current-password"
                      value={currentPassword}
                      onChange={setCurrentPassword}
                      placeholder="Enter current password"
                      autoComplete="current-password"
                      className="w-full rounded-xl border border-[#DBEAFE] bg-[#F8FBFF] px-4 py-3 pr-10 text-sm focus:border-[#007AFF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#BFDBFE]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#374151]">
                      New password
                    </label>
                    <PasswordInput
                      id="admin-new-password"
                      value={newPassword}
                      onChange={setNewPassword}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-[#DBEAFE] bg-[#F8FBFF] px-4 py-3 pr-10 text-sm focus:border-[#007AFF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#BFDBFE]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#374151]">
                      Confirm new password
                    </label>
                    <PasswordInput
                      id="admin-confirm-password"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      placeholder="Re-enter new password"
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-[#DBEAFE] bg-[#F8FBFF] px-4 py-3 pr-10 text-sm focus:border-[#007AFF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#BFDBFE]"
                    />
                  </div>

                  {error && <p className="text-sm text-[#DC2626]">{error}</p>}

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="rounded-xl bg-[#007AFF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0062CC] disabled:cursor-not-allowed disabled:bg-[#93C5FD]"
                  >
                    {submitting ? "Saving..." : "Update password"}
                  </button>
                </div>
              </article>

              <article className="rounded-3xl border border-[#DBEAFE] bg-gradient-to-br from-white to-[#F8FBFF] p-6">
                <div className="mb-4 flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#007AFF] ring-1 ring-[#DBEAFE]">
                    <Shield className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-[#111827]">
                      Security tips
                    </h2>
                    <p className="mt-1 text-sm text-[#6B7280]">
                      Keep your admin account protected.
                    </p>
                  </div>
                </div>

                <ul className="space-y-3 text-sm text-[#4B5563]">
                  <li>
                    Use a unique password you do not reuse on other sites.
                  </li>
                  <li>
                    Change your password if you suspect it has been shared.
                  </li>
                  <li>
                    Always sign out when using a shared or public computer.
                  </li>
                  <li>
                    Forgot your password, email, or username? Use{" "}
                    <Link
                      href="/admin/recover"
                      className="font-medium text-[#007AFF] hover:underline"
                    >
                      admin account recovery
                    </Link>
                    .
                  </li>
                  {adminRole === "superadmin" ? (
                    <li>
                      As superadmin, use the Admin team tab to create admins and
                      reset their passwords.
                    </li>
                  ) : (
                    <li>Do not share admin credentials with anyone.</li>
                  )}
                </ul>
              </article>
            </div>

            {adminRole === "superadmin" && (
              <article className="mt-6 rounded-3xl border border-[#FECACA] bg-gradient-to-br from-[#FFF5F5] to-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#FEE2E2] text-[#DC2626]">
                      <TriangleAlert className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-base font-semibold text-[#B91C1C]">
                        Danger zone
                      </h2>
                      <p className="mt-1 max-w-xl text-sm text-[#6B7280]">
                        Resetting the database permanently deletes all platform
                        data: users, schools, programmes, payments, checkers,
                        blog posts, and every request. Admin team accounts are
                        kept so you can still sign in. This cannot be undone.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setResetError(null);
                      setResetOpen(true);
                    }}
                    className="inline-flex w-fit flex-shrink-0 items-center gap-1.5 rounded-full border border-[#FECACA] bg-white px-4 py-2.5 text-xs font-semibold text-[#B91C1C] transition hover:bg-[#FEF2F2]"
                  >
                    <DatabaseZap className="h-3.5 w-3.5" />
                    Reset database
                  </button>
                </div>
              </article>
            )}
          </>
        )}
      </div>

      {resetOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
            onClick={closeResetModal}
          />
          <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-3xl border border-[#FECACA] bg-white p-6 shadow-xl sm:inset-x-auto">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#FEF2F2] text-[#DC2626]">
                <TriangleAlert className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-[#111827]">
                  Reset the entire database?
                </h3>
                <p className="mt-1 text-sm leading-5 text-[#6B7280]">
                  This permanently erases{" "}
                  <span className="font-medium text-[#B91C1C]">
                    all platform data
                  </span>{" "}
                  — every user, school, programme, payment, checker, blog post,
                  and request. Only admin team accounts survive. There is no
                  way to recover the data afterwards.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#374151]">
                  Type{" "}
                  <span className="font-mono font-semibold text-[#B91C1C]">
                    {RESET_CONFIRMATION_PHRASE}
                  </span>{" "}
                  to confirm
                </label>
                <input
                  type="text"
                  value={resetPhrase}
                  onChange={(e) => setResetPhrase(e.target.value)}
                  placeholder={RESET_CONFIRMATION_PHRASE}
                  autoComplete="off"
                  disabled={resetting}
                  className="w-full rounded-xl border border-[#FECACA] bg-[#FFF5F5] px-4 py-2.5 text-sm font-mono tracking-widest outline-none placeholder:text-[#FCA5A5] focus:border-[#DC2626] focus:bg-white focus:ring-2 focus:ring-[#FECACA]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#374151]">
                  Your password
                </label>
                <PasswordInput
                  id="reset-database-password"
                  value={resetPassword}
                  onChange={setResetPassword}
                  placeholder="Confirm with your password"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-[#FECACA] bg-[#FFF5F5] px-4 py-2.5 pr-10 text-sm outline-none focus:border-[#DC2626] focus:bg-white focus:ring-2 focus:ring-[#FECACA]"
                />
              </div>
            </div>

            {resetError && (
              <p className="mt-3 text-xs text-[#DC2626]" role="alert">
                {resetError}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={resetting}
                onClick={closeResetModal}
                className="rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-medium text-[#374151] transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!resetConfirmed || resetting}
                onClick={() => void handleResetDatabase()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#DC2626] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <DatabaseZap className="h-3.5 w-3.5" />
                {resetting ? "Resetting…" : "Reset database"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
