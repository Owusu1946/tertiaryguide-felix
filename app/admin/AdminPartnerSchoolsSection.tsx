"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  BadgeCheck,
  ExternalLink,
  ImagePlus,
  Loader2,
  Plus,
  Power,
  Save,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-client";
import { PasswordInput } from "@/app/components/PasswordInput";
import { normalizeBrandColor } from "@/lib/brand-theme";
import {
  normalizeSchoolCategories,
  SCHOOL_CATEGORIES,
  type SchoolCategory,
} from "@/lib/schoolCategories";

type PartnerSchool = {
  id: string;
  name: string;
  alias: string | null;
  slug: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  description: string | null;
  voucherPrice: number | null;
  admissionFee: number | null;
  requiresVoucher: boolean;
  isActive: boolean;
  logoSrc: string | null;
  logoAlt: string | null;
  deadline: string | null;
  brandColor: string | null;
  showBlogOnMain: boolean;
  isVerified?: boolean;
  categories?: string[];
  category?: string | null;
};

const emptyForm = {
  name: "",
  alias: "",
  slug: "",
  email: "",
  phone: "",
  showBlogOnMain: false,
  isVerified: true,
  adminUsername: "",
  adminPassword: "",
  adminEmail: "",
  categories: ["Private"] as SchoolCategory[],
};

function displayName(school: Pick<PartnerSchool, "name" | "alias">) {
  return school.alias?.trim() || school.name;
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return "—";
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return deadline;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function AdminPartnerSchoolsSection() {
  const [schools, setSchools] = useState<PartnerSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [existingLogoSrc, setExistingLogoSrc] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PartnerSchool | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminFetch("/api/admin/partner-schools");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setSchools(data.schools || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load partner schools");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const resetForm = () => {
    setForm(emptyForm);
    setLogoFile(null);
    setLogoPreview(null);
    setExistingLogoSrc(null);
    setEditingId(null);
  };

  const onLogoPick = (file: File | null) => {
    if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  };

  const startEdit = (school: PartnerSchool) => {
    setEditingId(school.id);
    setForm({
      name: school.name,
      alias: school.alias || "",
      slug: school.slug || "",
      email: school.email || "",
      phone: school.phone || "",
      showBlogOnMain: school.showBlogOnMain === true,
      isVerified: school.isVerified !== false,
      adminUsername: "",
      adminPassword: "",
      adminEmail: "",
      categories: normalizeSchoolCategories(
        school.categories,
        school.category,
      ),
    });
    setLogoFile(null);
    setLogoPreview(null);
    setExistingLogoSrc(school.logoSrc);
    setMessage(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleCategory = (category: SchoolCategory) => {
    setForm((f) => {
      const current = new Set(f.categories);
      if (current.has(category)) {
        if (current.size <= 1) return f;
        current.delete(category);
      } else {
        current.add(category);
      }
      return {
        ...f,
        categories: normalizeSchoolCategories([...current]),
      };
    });
  };

  const uploadLogoIfNeeded = async (): Promise<string | undefined> => {
    if (!logoFile) return undefined;
    const uploadForm = new FormData();
    uploadForm.append("file", logoFile);
    const uploadRes = await fetch("/api/admin/upload-logo", {
      method: "POST",
      body: uploadForm,
    });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok || !uploadData?.url) {
      throw new Error(uploadData?.error || "Could not upload logo");
    }
    return uploadData.url as string;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    try {
      setSaving(true);
      setMessage(null);
      setError(null);

      if (!editingId) {
        if (!form.email.trim()) {
          throw new Error("School email is required for the portal invite.");
        }
        if (!form.adminUsername.trim() || !form.adminPassword) {
          throw new Error(
            "School admin username and password are required.",
          );
        }
        if (form.adminPassword.length < 8) {
          throw new Error("School admin password must be at least 8 characters.");
        }
      }

      const logoSrc = await uploadLogoIfNeeded();

      if (form.categories.length === 0) {
        throw new Error("Select at least one category.");
      }

      const payload = {
        name: form.name,
        alias: form.alias || undefined,
        slug: form.slug || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        showBlogOnMain: form.showBlogOnMain,
        isVerified: form.isVerified !== false,
        categories: form.categories,
        ...(logoSrc
          ? { logoSrc, logoAlt: form.alias || form.name }
          : editingId && !existingLogoSrc && !logoFile
            ? { logoSrc: null, logoAlt: form.alias || form.name }
            : { logoAlt: form.alias || form.name }),
        ...(editingId
          ? {}
          : {
              adminUsername: form.adminUsername.trim(),
              adminPassword: form.adminPassword,
              adminEmail: form.adminEmail.trim() || form.email.trim(),
            }),
      };

      const res = await adminFetch(
        editingId
          ? `/api/admin/partner-schools/${editingId}`
          : "/api/admin/partner-schools",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      const createdEmail = form.email.trim();
      const createdAdminUsername = form.adminUsername.trim();
      resetForm();
      if (editingId) {
        setMessage(`Updated ${data.school?.name || "school"}`);
      } else {
        const inviteNote = data.invite?.emailSent
          ? ` Invite emailed to ${createdEmail}.`
          : data.invite?.emailError
            ? ` School created, but invite email failed: ${data.invite.emailError}`
            : "";
        setMessage(
          `Created ${data.school?.name || "school"} with admin ${data.schoolAdmin?.username || createdAdminUsername}.${inviteNote}`,
        );
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save school");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (school: PartnerSchool) => {
    const res = await adminFetch(`/api/admin/partner-schools/${school.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !school.isActive }),
    });
    if (res.ok) await load();
  };

  const deleteSchool = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await adminFetch(
        `/api/admin/partner-schools/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to delete school",
        );
      }
      if (editingId === deleteTarget.id) resetForm();
      setDeleteTarget(null);
      setMessage(`Deleted ${deleteTarget.name}`);
      await load();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete school",
      );
    } finally {
      setDeleting(false);
    }
  };

  const actionBtnClass =
    "inline-flex items-center gap-1 rounded-full border border-[#BFDBFE] bg-white px-3 py-1 text-xs font-medium text-[#007AFF] transition hover:bg-[#EFF6FF]";
  const dangerBtnClass =
    "inline-flex items-center gap-1 rounded-full border border-[#FECACA] bg-white px-3 py-1 text-xs font-medium text-[#B91C1C] transition hover:bg-[#FEF2F2]";
  const mutedBtnClass =
    "inline-flex items-center gap-1 rounded-full border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-medium text-[#374151] transition hover:bg-[#F9FAFB]";

  const previewSrc = logoPreview || existingLogoSrc;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[#BFDBFE] bg-gradient-to-r from-[#EAF4FF] via-white to-[#F2F8FF] px-5 py-6 shadow-sm sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#007AFF] shadow-sm ring-1 ring-[#DBEAFE]">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-[#050816]">Partner schools</h2>
            <p className="mt-1 text-sm text-[#6B7280]">
              Create a secured school account with logo and admin login. The
              school completes pricing, branding, and deadlines in their own
              portal.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            {editingId ? (
              <>
                <Save className="h-4 w-4 text-[#007AFF]" />
                Edit partner school
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 text-[#007AFF]" />
                Add partner school
              </>
            )}
          </h3>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1 rounded-full border border-[#E5E7EB] px-3 py-1.5 text-xs font-medium text-[#6B7280]"
            >
              <X className="h-3.5 w-3.5" /> Cancel edit
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          {/* Logo upload */}
          <div className="md:col-span-2">
            <p className="mb-2 text-sm font-medium text-[#374151]">School logo</p>
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC]">
                {previewSrc ? (
                  <Image
                    src={previewSrc}
                    alt="School logo preview"
                    fill
                    className="object-contain p-1.5"
                    unoptimized={previewSrc.startsWith("blob:")}
                  />
                ) : (
                  <ImagePlus className="h-7 w-7 text-[#9CA3AF]" />
                )}
              </div>
              <div className="space-y-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-2 text-sm font-medium text-[#007AFF] hover:bg-[#DBEAFE]">
                  <ImagePlus className="h-4 w-4" />
                  {previewSrc ? "Change logo" : "Upload logo"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => onLogoPick(e.target.files?.[0] ?? null)}
                  />
                </label>
                {(logoFile || existingLogoSrc) && (
                  <button
                    type="button"
                    onClick={() => {
                      onLogoPick(null);
                      setExistingLogoSrc(null);
                    }}
                    className="block text-xs text-[#DC2626]"
                  >
                    Remove logo
                  </button>
                )}
                <p className="text-xs text-[#9CA3AF]">PNG, JPG, WEBP or SVG. Shown on apply pages.</p>
              </div>
            </div>
          </div>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[#374151]">School name *</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 outline-none focus:border-[#007AFF]"
              placeholder="Holy Spirit College of Education"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[#374151]">Alias (short display name)</span>
            <input
              value={form.alias}
              onChange={(e) => setForm((f) => ({ ...f, alias: e.target.value }))}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 outline-none focus:border-[#007AFF]"
              placeholder="Holy Spirit College"
            />
            <span className="text-xs text-[#9CA3AF]">
              Used on cards and headers when set. Falls back to full name.
            </span>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[#374151]">Slug (URL)</span>
            <input
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 outline-none focus:border-[#007AFF]"
              placeholder="holyspirit"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[#374151]">Email *</span>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 outline-none focus:border-[#007AFF]"
              placeholder="admissions@school.edu.gh"
            />
            <span className="text-xs text-[#9CA3AF]">
              Portal invite is sent here. Share username/password with the school separately.
            </span>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[#374151]">Phone</span>
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 outline-none focus:border-[#007AFF]"
            />
          </label>
          <div className="space-y-2 md:col-span-2">
            <p className="text-sm font-medium text-[#374151]">Categories</p>
            <div className="flex flex-wrap gap-2">
              {SCHOOL_CATEGORIES.map((category) => {
                const checked = form.categories.includes(category);
                return (
                  <label
                    key={category}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#111827] has-[:checked]:border-[#007AFF] has-[:checked]:bg-[#EFF6FF] has-[:checked]:text-[#007AFF]"
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-[#D1D5DB] text-[#007AFF] focus:ring-[#007AFF]"
                      checked={checked}
                      onChange={() => toggleCategory(category)}
                    />
                    {category}
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-[#9CA3AF]">
              Controls which All Forms tabs this school appears under (Public,
              Private, Training College, TVET, Nursing). At least one is
              required.
            </p>
          </div>

          <label className="flex items-start gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={form.isVerified !== false}
              onChange={(e) => setForm((f) => ({ ...f, isVerified: e.target.checked }))}
              className="mt-0.5 h-4 w-4 rounded border-[#D1D5DB]"
            />
            <span>
              <span className="font-medium text-[#374151]">Verified partner school</span>
              <span className="mt-0.5 block text-xs text-[#9CA3AF]">
                Shows the verified checkmark next to this school on public pages.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={form.showBlogOnMain}
              onChange={(e) => setForm((f) => ({ ...f, showBlogOnMain: e.target.checked }))}
              className="mt-0.5 h-4 w-4 rounded border-[#D1D5DB]"
            />
            <span>
              <span className="font-medium text-[#374151]">
                Feature school posts on TertiaryGuide homepage &amp; main blog
              </span>
              <span className="mt-0.5 block text-xs text-[#9CA3AF]">
                Platform admins / superadmins only. When off, published posts
                stay on this school&apos;s blog page only.
              </span>
            </span>
          </label>

          {!editingId && (
            <div className="md:col-span-2 mt-2 space-y-3 border-t border-[#F3F4F6] pt-4">
              <div>
                <p className="text-sm font-medium text-[#374151]">
                  School admin account *
                </p>
                <p className="mt-0.5 text-xs text-[#9CA3AF]">
                  Share these credentials with the school. An invite email with a
                  one-month sign-in link is sent to the school email above.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-[#374151]">Username *</span>
                  <input
                    required
                    value={form.adminUsername}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, adminUsername: e.target.value }))
                    }
                    placeholder="schooladmin"
                    className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#007AFF]"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-[#374151]">Admin email</span>
                  <input
                    type="email"
                    value={form.adminEmail}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, adminEmail: e.target.value }))
                    }
                    placeholder="Defaults to school email"
                    className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#007AFF]"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-[#374151]">Password *</span>
                  <PasswordInput
                    id="partner-school-admin-password"
                    value={form.adminPassword}
                    onChange={(value) =>
                      setForm((f) => ({ ...f, adminPassword: value }))
                    }
                    placeholder="Min 8 characters"
                    defaultVisible
                    autoComplete="new-password"
                    className="block w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 pr-10 text-sm outline-none focus:border-[#007AFF]"
                  />
                </label>
              </div>
            </div>
          )}

          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-[#007AFF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0066D6] disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingId ? "Save changes" : "Create school"}
            </button>
            {message && <p className="text-sm text-[#16A34A]">{message}</p>}
            {error && <p className="text-sm text-[#DC2626]">{error}</p>}
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-3xl border border-[#E5E7EB] bg-white shadow-sm">
        <div className="border-b border-[#F3F4F6] px-5 py-4">
          <h3 className="font-semibold text-[#050816]">Partner schools list</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-[#6B7280]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : schools.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[#6B7280]">
            No partner schools yet. Create one above.
          </p>
        ) : (
          <div className="px-3 pb-4 pt-2 sm:px-4">
            <div
              className="grid grid-cols-[minmax(0,1fr)_5.25rem] items-center gap-x-2 border-b border-gray-200/90 px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-[#007AFF] sm:grid-cols-[minmax(0,1fr)_9rem] sm:px-2.5 sm:text-[11px]"
              role="row"
            >
              <span className="min-w-0 text-left">School</span>
              <span className="text-right tabular-nums">Deadline</span>
            </div>
            <div className="mt-1 flex flex-col gap-1">
              {schools.map((s) => {
                const selected = editingId === s.id;
                return (
                  <div key={s.id} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => startEdit(s)}
                      className={`group grid w-full min-w-0 grid-cols-[minmax(0,1fr)_5.25rem] items-center gap-x-2 px-2 py-2.5 text-left transition-all duration-150 sm:grid-cols-[minmax(0,1fr)_9rem] sm:px-2.5 sm:py-3 ${
                        selected
                          ? "rounded-2xl bg-[#007AFF] text-white"
                          : "rounded-none bg-white hover:rounded-2xl hover:bg-[#007AFF] hover:text-white"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <div
                          className={`relative h-7 w-7 shrink-0 overflow-hidden rounded-sm ${
                            selected ? "bg-white/95 p-0.5" : "group-hover:bg-white/95 group-hover:p-0.5"
                          }`}
                        >
                          {s.logoSrc ? (
                            <Image
                              src={s.logoSrc}
                              alt={s.logoAlt || displayName(s)}
                              fill
                              className="object-contain"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-[#007AFF]">
                              <Building2 className="h-4 w-4" />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p
                            className={`flex items-center gap-1 truncate text-sm font-medium ${
                              selected ? "text-white" : "text-[#1E1E1E] group-hover:text-white"
                            }`}
                          >
                            {displayName(s)}
                            {s.isVerified !== false && (
                              <BadgeCheck
                                className={`h-3.5 w-3.5 shrink-0 ${
                                  selected ? "text-white" : "text-[#007AFF] group-hover:text-white"
                                }`}
                                fill="currentColor"
                                stroke={selected ? "transparent" : "white"}
                              />
                            )}
                          </p>
                          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                            <span
                              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-white/40"
                              style={{
                                backgroundColor: normalizeBrandColor(s.brandColor),
                              }}
                              title={normalizeBrandColor(s.brandColor)}
                            />
                            <p
                              className={`min-w-0 truncate text-[10px] ${
                                selected
                                  ? "text-white/80"
                                  : "text-[#6B7280] group-hover:text-white/80"
                              }`}
                            >
                              {normalizeSchoolCategories(
                                s.categories,
                                s.category,
                              ).join(" · ")}
                            </p>
                            {!s.isActive && (
                              <p
                                className={`shrink-0 text-[10px] ${
                                  selected ? "text-white/80" : "text-[#DC2626] group-hover:text-red-100"
                                }`}
                              >
                                Disabled
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`w-full text-right text-xs font-medium tabular-nums sm:text-sm ${
                          selected ? "text-white" : "text-[#1E1E1E] group-hover:text-white"
                        }`}
                      >
                        {formatDeadline(s.deadline)}
                      </span>
                    </button>
                    {selected && (
                      <div className="flex flex-wrap items-center gap-2 px-2 pb-2">
                        {s.slug && (
                          <>
                            <Link
                              href={`/admin/${s.slug}`}
                              className={actionBtnClass}
                            >
                              Portal <ExternalLink className="h-3 w-3" />
                            </Link>
                            <Link
                              href={`/apply/school/${s.slug}`}
                              className={actionBtnClass}
                            >
                              Public page <ExternalLink className="h-3 w-3" />
                            </Link>
                            <Link
                              href={`/blog?schoolId=${s.id}`}
                              className={actionBtnClass}
                            >
                              School blog <ExternalLink className="h-3 w-3" />
                            </Link>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => void toggleActive(s)}
                          className={mutedBtnClass}
                        >
                          <Power className="h-3 w-3" />
                          {s.isActive ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(s);
                          }}
                          className={dangerBtnClass}
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {deleteTarget && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
            onClick={() => {
              if (!deleting) setDeleteTarget(null);
            }}
          />
          <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-3xl border border-[#FECACA] bg-white p-6 shadow-xl sm:inset-x-auto">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#FEF2F2] text-[#DC2626]">
                <TriangleAlert className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-[#111827]">
                  Delete partner school?
                </h3>
                <p className="mt-1 text-sm leading-5 text-[#6B7280]">
                  <span className="font-medium text-[#111827]">
                    {displayName(deleteTarget)}
                  </span>{" "}
                  will be permanently removed, including school admins,
                  programmes, vouchers, payments, applications, and school blog
                  posts. This cannot be undone.
                </p>
              </div>
            </div>

            {deleteError && (
              <p className="mt-3 text-xs text-[#DC2626]" role="alert">
                {deleteError}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="rounded-full border border-[#E5E7EB] px-4 py-2 text-xs font-medium text-[#6B7280] hover:bg-[#F9FAFB] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void deleteSchool()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#DC2626] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {deleting ? "Deleting…" : "Delete school"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
