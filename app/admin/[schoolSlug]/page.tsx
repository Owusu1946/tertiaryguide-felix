"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Download,
  Eye,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  LogOut,
  Newspaper,
  Search,
  Settings,
  Ticket,
  Trash2,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { adminFetch, getAdminRole } from "@/lib/admin-client";
import {
  brandThemeStyle,
  DEFAULT_BRAND_COLOR,
  formatSchoolDeadline,
  normalizeBrandColors,
  brandGradient,
  blendBrandColors,
} from "@/lib/brand-theme";
import { isDeadlineCalendarExpired } from "@/lib/deadlines";
import { ApplicationDocuments } from "../../components/ApplicationDocuments";
import {
  ApplicationPrintout,
  downloadApplicationPrintout,
  printoutFromDetail,
} from "../../components/ApplicationPrintout";
import type { RankedProgrammeChoice } from "@/lib/admissions/programme-choices";
import {
  studentStatusBadgeClass,
  studentStatusCopy,
} from "@/lib/admissions/status-messages";
import { ProgrammesSection } from "./ProgrammesSection";
import { BlogSection } from "./BlogSection";
import { SettingsSection } from "./SettingsSection";
import { AnalyticsSection } from "./AnalyticsSection";

type Tab =
  | "dashboard"
  | "applicants"
  | "accepted"
  | "declined"
  | "programmes"
  | "blog"
  | "transactions"
  | "analytics"
  | "settings";

type Metrics = {
  totalApplications: number;
  applicationsToday: number;
  approvedApplications: number;
  rejectedApplications: number;
  pendingApplications: number;
  underReviewApplications: number;
  admittedApplications: number;
  acceptedOffers?: number;
  declinedOffers?: number;
  totalRevenue: number;
  totalVouchersSold: number;
  undergraduateVouchersSold?: number;
  postgraduateVouchersSold?: number;
};

type ApplicationRow = {
  id: string;
  applicationNumber: string;
  fullName: string;
  phone: string | null;
  email: string;
  programme: string | null;
  admittedProgramme?: string | null;
  admittedProgrammeStream?: string | null;
  offerResponse?: "accepted" | "declined" | null;
  status: string;
  submittedAt: string;
  personalInfo?: Record<string, string | undefined> | null;
  guardianInfo?: Record<string, string | undefined> | null;
  programmeChoices?: Record<string, string | undefined> | null;
  programmes?: RankedProgrammeChoice[];
  educationalBackground?: Record<string, string | undefined>[];
  examinationInfo?: Record<string, string | undefined> | null;
  additionalExaminations?: Record<string, string | undefined>[] | null;
  examinationSittings?: Array<
    Record<string, string | undefined> & {
      results?: { subject: string; grade: string }[];
    }
  > | null;
  results?: { subject: string; grade: string }[];
  documents?: Record<string, string | undefined> | null;
};

type Transaction = {
  id: string;
  reference: string;
  email: string;
  fullName: string | null;
  amount: number;
  status: string;
  product: string;
  programmeLevel?: string;
  paidAt: string | null;
};

export default function SchoolAdminPortalPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#F3F4F6]">
          <Loader2 className="h-6 w-6 animate-spin text-[#007AFF]" />
        </main>
      }
    >
      <SchoolAdminPortalContent />
    </Suspense>
  );
}

function SchoolAdminPortalContent() {
  const params = useParams<{ schoolSlug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.schoolSlug;

  const initialTab = (searchParams.get("tab") as Tab) || "dashboard";
  const [tab, setTab] = useState<Tab>(
    [
      "dashboard",
      "applicants",
      "accepted",
      "declined",
      "programmes",
      "blog",
      "transactions",
      "analytics",
      "settings",
    ].includes(initialTab)
      ? initialTab
      : "dashboard",
  );
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [schoolName, setSchoolName] = useState("");
  const [schoolAlias, setSchoolAlias] = useState<string | null>(null);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [schoolDeadline, setSchoolDeadline] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState(DEFAULT_BRAND_COLOR);
  const [brandColors, setBrandColors] = useState<string[]>([DEFAULT_BRAND_COLOR]);
  const [voucherPrice, setVoucherPrice] = useState<number | null>(null);
  const [undergraduateVoucherPrice, setUndergraduateVoucherPrice] = useState<
    number | null
  >(null);
  const [postgraduateVoucherPrice, setPostgraduateVoucherPrice] = useState<
    number | null
  >(null);
  const [schoolDescription, setSchoolDescription] = useState<string | null>(
    null,
  );
  const [schoolPhone, setSchoolPhone] = useState<string | null>(null);
  const [schoolEmail, setSchoolEmail] = useState<string | null>(null);
  const [schoolAddress, setSchoolAddress] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [analytics, setAnalytics] = useState<{
    applicationsPerDay: { date: string; count: number }[];
    applicationsPerMonth: { month: string; count: number }[];
    applicationsByStatus: { status: string; count: number }[];
    revenuePerMonth: { month: string; total: number; count: number }[];
    vouchersByLevel?: {
      undergraduate: { count: number; revenue: number };
      postgraduate: { count: number; revenue: number };
    };
    vouchersPerMonthByLevel?: {
      month: string;
      undergraduate: number;
      postgraduate: number;
      undergradRevenue: number;
      postgradRevenue: number;
    }[];
  } | null>(null);
  const [selected, setSelected] = useState<ApplicationRow | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [actorLabel, setActorLabel] = useState("");
  const [admitTarget, setAdmitTarget] = useState<ApplicationRow | null>(null);
  const [admitProgramme, setAdmitProgramme] = useState("");
  const [admitBusy, setAdmitBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<ApplicationRow | null>(null);
  const [rejectBusy, setRejectBusy] = useState(false);

  useEffect(() => {
    if (!statusNotice) return;
    const timer = window.setTimeout(() => setStatusNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [statusNotice]);

  useEffect(() => {
    const role = getAdminRole();
    const username =
      typeof window !== "undefined"
        ? window.localStorage.getItem("tg_admin_username")
        : null;
    if (!username || !role) {
      router.replace("/admin/signin");
      return;
    }
    if (role === "school_admin") {
      const ownSlug = window.localStorage.getItem("tg_school_slug");
      if (ownSlug && ownSlug !== slug) {
        router.replace(`/admin/${ownSlug}`);
        return;
      }
    }
    setCheckingAuth(false);
  }, [router, slug]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch(`/api/school-portal/${slug}/metrics`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load portal");
      setSchoolName(data.school?.name || slug);
      setSchoolAlias(data.school?.alias || null);
      setSchoolLogo(data.school?.logoSrc || null);
      setSchoolId(
        typeof data.school?.id === "string"
          ? data.school.id
          : window.localStorage.getItem("tg_school_id"),
      );
      setSchoolDeadline(data.school?.deadline ?? null);
      const nextColors = normalizeBrandColors(
        data.school?.brandColors,
        data.school?.brandColor,
      );
      setBrandColors(nextColors);
      setBrandColor(blendBrandColors(nextColors));
      setVoucherPrice(
        typeof data.school?.voucherPrice === "number"
          ? data.school.voucherPrice
          : null,
      );
      setUndergraduateVoucherPrice(
        typeof data.school?.undergraduateVoucherPrice === "number"
          ? data.school.undergraduateVoucherPrice
          : typeof data.school?.voucherPrice === "number"
            ? data.school.voucherPrice
            : null,
      );
      setPostgraduateVoucherPrice(
        typeof data.school?.postgraduateVoucherPrice === "number"
          ? data.school.postgraduateVoucherPrice
          : null,
      );
      setSchoolDescription(data.school?.description ?? null);
      setSchoolPhone(data.school?.phone ?? null);
      setSchoolEmail(data.school?.email ?? null);
      setSchoolAddress(data.school?.address ?? null);
      setMetrics(data.metrics);
      setActorLabel(
        data.actor?.kind === "staff"
          ? `${data.actor.username} (platform)`
          : data.actor?.username || "",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const loadApplicants = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab === "accepted") {
        params.set("offerResponse", "accepted");
      } else if (tab === "declined") {
        params.set("offerResponse", "declined");
      } else if (statusFilter) {
        params.set("status", statusFilter);
      }
      if (query) params.set("q", query);
      const res = await adminFetch(
        `/api/school-portal/${slug}/applications?${params.toString()}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load applicants");
      setApplications(data.applications || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load applicants");
    } finally {
      setLoading(false);
    }
  }, [slug, statusFilter, query, tab]);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/school-portal/${slug}/transactions`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load transactions");
      setTransactions(data.transactions || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/school-portal/${slug}/analytics`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load analytics");
      setAnalytics(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (checkingAuth) return;
    void loadDashboard();
  }, [checkingAuth, loadDashboard]);

  useEffect(() => {
    if (checkingAuth) return;
    if (tab === "applicants" || tab === "accepted" || tab === "declined") {
      setSelectedIds(new Set());
      void loadApplicants();
    }
    if (tab === "transactions") void loadTransactions();
    if (tab === "analytics") void loadAnalytics();
  }, [
    checkingAuth,
    tab,
    loadApplicants,
    loadTransactions,
    loadAnalytics,
  ]);

  useEffect(() => {
    const id = searchParams.get("id");
    if (id && applications.length) {
      const found = applications.find((a) => a.id === id);
      if (found) setSelected(found);
    }
  }, [searchParams, applications]);

  const updateStatus = async (
    id: string,
    status: string,
    extra?: { admittedProgramme?: string; admittedProgrammeStream?: string },
  ) => {
    if (status === "Admitted" && !extra?.admittedProgramme?.trim()) {
      setError("Select a programme before admitting the student.");
      return;
    }
    setStatusNotice(null);
    const res = await adminFetch(`/api/school-portal/${slug}/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        ...(extra?.admittedProgramme
          ? {
              admittedProgramme: extra.admittedProgramme,
              admittedProgrammeStream: extra.admittedProgrammeStream || null,
            }
          : {}),
      }),
    });
    const data = await res.json();
    if (res.ok && data.application) {
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...data.application } : a)),
      );
      setSelected((prev) =>
        prev?.id === id ? { ...prev, ...data.application } : prev,
      );
      void loadDashboard();
      const actionLabel =
        status === "Approved"
          ? "Application approved"
          : status === "Admitted"
            ? "Admission offer sent"
            : status === "Rejected"
              ? "Application rejected"
              : status === "Under Review"
                ? "Marked under review"
                : `Status updated to ${status}`;
      setStatusNotice(
        data.emailed
          ? `${actionLabel}. The student has been emailed and will see this in their portal.`
          : `${actionLabel}. It will show on the student’s portal.`,
      );
      setAdmitTarget(null);
      setAdmitProgramme("");
      setRejectTarget(null);
    } else {
      setError(data.error || "Could not update status");
    }
  };

  const openRejectModal = (app: ApplicationRow) => {
    setRejectTarget(app);
  };

  const confirmReject = async () => {
    if (!rejectTarget || rejectBusy) return;
    setRejectBusy(true);
    try {
      await updateStatus(rejectTarget.id, "Rejected");
    } finally {
      setRejectBusy(false);
    }
  };

  const openAdmitModal = (app: ApplicationRow) => {
    const choices = (app.programmes || [])
      .map((p) => p.display)
      .filter(Boolean);
    const first = choices[0] || app.programme || "";
    setAdmitTarget(app);
    setAdmitProgramme(first);
    setError(null);
  };

  const confirmAdmit = async () => {
    if (!admitTarget || !admitProgramme.trim()) {
      setError("Select the programme this student qualifies for.");
      return;
    }
    setAdmitBusy(true);
    try {
      const selectedChoice = (admitTarget.programmes || []).find(
        (p) => p.display === admitProgramme,
      );
      await updateStatus(admitTarget.id, "Admitted", {
        admittedProgramme: selectedChoice?.programme || admitProgramme,
        admittedProgrammeStream: selectedChoice?.stream || undefined,
      });
    } finally {
      setAdmitBusy(false);
    }
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const visibleIds = applications.map((a) => a.id);
      const allSelected =
        visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(visibleIds);
    });
  };

  const confirmDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setDeleteBusy(true);
    setError(null);
    try {
      const res = await adminFetch(`/api/school-portal/${slug}/applications`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete applicants");
      setSelectedIds(new Set());
      setDeleteConfirmOpen(false);
      if (selected && ids.includes(selected.id)) setSelected(null);
      setStatusNotice(
        data.message ||
          "Applicants removed. TertiaryGuide keeps a recoverable backup.",
      );
      void loadApplicants();
      void loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete applicants");
    } finally {
      setDeleteBusy(false);
    }
  };

  const printoutSchool = {
    name: schoolName,
    logoSrc: schoolLogo,
    brandColor,
    brandColors,
    phone: schoolPhone,
    email: schoolEmail,
    address: schoolAddress,
  };

  const downloadSelected = () => {
    if (!selected || downloadingPdf) return;
    setDownloadingPdf(true);
    void downloadApplicationPrintout({
      school: printoutSchool,
      data: printoutFromDetail(selected, selected.programmes),
    }).finally(() => setDownloadingPdf(false));
  };

  const metricCards = useMemo(() => {
    if (!metrics) return [];
    return [
      {
        label: "Total Applications",
        value: metrics.totalApplications,
        icon: Users,
        target: "applicants" as Tab,
      },
      {
        label: "Applications Today",
        value: metrics.applicationsToday,
        icon: CalendarClock,
        target: "applicants" as Tab,
      },
      {
        label: "Approved",
        value: metrics.approvedApplications,
        icon: CheckCircle2,
        target: "applicants" as Tab,
        filter: "Approved",
      },
      {
        label: "Rejected",
        value: metrics.rejectedApplications,
        icon: XCircle,
        target: "applicants" as Tab,
        filter: "Rejected",
      },
      {
        label: "Pending",
        value: metrics.pendingApplications,
        icon: LayoutDashboard,
        target: "applicants" as Tab,
        filter: "Pending",
      },
      {
        label: "Under Review",
        value: metrics.underReviewApplications,
        icon: Search,
        target: "applicants" as Tab,
        filter: "Under Review",
      },
      {
        label: "Admitted (offers)",
        value: metrics.admittedApplications,
        icon: CheckCircle2,
        target: "applicants" as Tab,
        filter: "Admitted",
      },
      {
        label: "Accepted offers",
        value: metrics.acceptedOffers ?? 0,
        icon: CheckCircle2,
        target: "accepted" as Tab,
      },
      {
        label: "Declined offers",
        value: metrics.declinedOffers ?? 0,
        icon: XCircle,
        target: "declined" as Tab,
      },
      {
        label: "Total Revenue (GHS)",
        value: metrics.totalRevenue.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        }),
        icon: Wallet,
        target: "transactions" as Tab,
      },
      {
        label: "Vouchers Sold",
        value: metrics.totalVouchersSold,
        icon: Ticket,
        target: "transactions" as Tab,
      },
      {
        label: "Undergraduate vouchers",
        value: metrics.undergraduateVouchersSold ?? 0,
        icon: Ticket,
        target: "transactions" as Tab,
      },
      {
        label: "Postgraduate vouchers",
        value: metrics.postgraduateVouchersSold ?? 0,
        icon: Ticket,
        target: "transactions" as Tab,
      },
    ];
  }, [metrics]);

  const themeStyle = useMemo(
    () => brandThemeStyle({ brandColor, brandColors }),
    [brandColor, brandColors],
  );
  const deadlineExpired = isDeadlineCalendarExpired(schoolDeadline);

  const handleLogout = () => {
    window.localStorage.removeItem("tg_admin_username");
    window.localStorage.removeItem("tg_admin_role");
    window.localStorage.removeItem("tg_school_slug");
    window.localStorage.removeItem("tg_school_id");
    router.push("/admin/signin");
  };

  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F3F4F6]">
        <Loader2 className="h-6 w-6 animate-spin text-[#007AFF]" />
      </main>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "applicants", label: "Applicants", icon: Users },
    { id: "accepted", label: "Accepted students", icon: CheckCircle2 },
    { id: "declined", label: "Declined students", icon: XCircle },
    { id: "programmes", label: "Programmes", icon: BookOpen },
    { id: "blog", label: "Blog", icon: Newspaper },
    { id: "transactions", label: "Transactions", icon: CreditCard },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <main
      className="min-h-screen bg-[#F3F4F6] px-4 py-4 text-[#050816] sm:px-6"
      style={themeStyle}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border border-[var(--school-brand-border)] bg-gradient-to-r from-[var(--school-brand-soft)] via-white to-[var(--school-brand-soft)] px-4 py-4 shadow-sm sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-[var(--school-brand-border)] bg-white shadow-sm">
                {schoolLogo ? (
                  <Image
                    src={schoolLogo}
                    alt={schoolAlias || schoolName || "School"}
                    fill
                    className="object-contain p-1"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-2xl bg-white px-1">
                    <Image
                      src="/hero/logoTguide.png"
                      alt="TertiaryGuide"
                      width={40}
                      height={24}
                      className="h-6 w-auto"
                    />
                  </div>
                )}
              </div>
              <div>
                <p className="text-base font-semibold sm:text-lg">
                  {(schoolAlias || schoolName || "School")} Admissions
                </p>
                <p className="text-xs text-[#6B7280]">
                  /admin/{slug}
                  {schoolAlias && schoolName && schoolAlias !== schoolName
                    ? ` · ${schoolName}`
                    : ""}
                  {actorLabel ? ` · ${actorLabel}` : ""}
                </p>
                <p
                  className={`mt-1 inline-flex items-center gap-1.5 text-xs font-medium ${
                    deadlineExpired ? "text-[#DC2626]" : "text-[var(--school-brand)]"
                  }`}
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  Deadline: {formatSchoolDeadline(schoolDeadline)}
                  {deadlineExpired ? " (Expired)" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="hidden h-8 w-8 rounded-full border border-white shadow-sm sm:inline-block"
                style={{ backgroundImage: brandGradient(brandColors) }}
                title={`Brand ${brandColors.join(" · ")}`}
              />
              {getAdminRole() !== "school_admin" && (
                <Link
                  href="/admin"
                  className="rounded-full border border-[var(--school-brand-border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--school-brand)]"
                >
                  Platform admin
                </Link>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--school-brand-border)] bg-white px-3 py-1.5 text-xs font-medium"
              >
                <LogOut className="h-3.5 w-3.5" /> Logout
              </button>
            </div>
          </div>
          <nav className="mt-4 flex gap-2 overflow-x-auto border-b border-[var(--school-brand-border)] pb-px text-sm">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-t-2xl px-3 py-2 ${
                    active
                      ? "border-b-2 border-[var(--school-brand)] bg-white text-[var(--school-brand)]"
                      : "text-[#4B5563] hover:text-[var(--school-brand)]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </nav>
        </header>

        {error && (
          <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
            {error}
          </div>
        )}

        {tab === "dashboard" && (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {loading && !metrics ? (
              <div className="col-span-full flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--school-brand)]" />
              </div>
            ) : (
              metricCards.map((m) => {
                const Icon = m.icon;
                const tone =
                  m.label === "Approved" || m.label === "Admitted (offers)" || m.label === "Accepted offers"
                    ? "success"
                    : m.label === "Rejected" || m.label === "Declined offers"
                      ? "danger"
                      : m.label === "Pending" || m.label === "Under Review"
                        ? "warning"
                        : "default";
                const toneStyles =
                  tone === "success"
                    ? {
                        border: "border-emerald-100",
                        icon: "bg-emerald-50 text-emerald-600",
                        accent: "bg-emerald-500",
                      }
                    : tone === "danger"
                      ? {
                          border: "border-rose-100",
                          icon: "bg-rose-50 text-rose-600",
                          accent: "bg-rose-500",
                        }
                      : tone === "warning"
                        ? {
                            border: "border-amber-100",
                            icon: "bg-amber-50 text-amber-600",
                            accent: "bg-amber-500",
                          }
                        : {
                            border: "border-[var(--school-brand-border)]",
                            icon: "bg-[var(--school-brand-soft)] text-[var(--school-brand)]",
                            accent: "bg-[var(--school-brand)]",
                          };
                return (
                    <button
                    key={m.label}
                      type="button"
                      onClick={() => {
                        setStatusFilter(m.filter || "");
                        setTab(m.target);
                      }}
                      aria-label={`Open ${m.label}`}
                    className={`group relative min-h-[110px] w-full overflow-hidden rounded-3xl border bg-white px-5 py-4 text-left shadow-[0_8px_22px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(15,23,42,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--school-brand)] focus-visible:ring-offset-2 ${toneStyles.border}`}
                  >
                    <span
                      className={`absolute inset-x-0 top-0 h-1 ${toneStyles.accent}`}
                      aria-hidden="true"
                    />
                    <div className="flex items-start justify-between gap-3">
                      <p className="pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">
                        {m.label}
                      </p>
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${toneStyles.icon}`}>
                        <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
                      </span>
                    </div>
                    <p className="mt-3 text-3xl font-bold tracking-tight text-[#050816]">
                      {m.value}
                    </p>
                    <span className="pointer-events-none absolute bottom-3 right-5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#94A3B8] opacity-0 transition-opacity group-hover:opacity-100">
                      Open
                    </span>
                  </button>
                );
              })
            )}
          </section>
        )}

        {(tab === "applicants" || tab === "accepted" || tab === "declined") && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void loadApplicants();
                  }}
                  placeholder="Search name, email, phone…"
                className="w-full rounded-full border border-[#E5E7EB] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--school-brand)]"
              />
              </div>
              {tab === "applicants" ? (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="cursor-pointer rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                >
                  <option value="">All statuses</option>
                  {["Pending", "Under Review", "Approved", "Rejected", "Admitted"].map(
                    (s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ),
                  )}
                </select>
              ) : (
                <p className="text-sm text-[#6B7280]">
                  {tab === "accepted"
                    ? "Students who accepted their admission offer"
                    : "Students who declined their admission offer"}
                </p>
              )}
              <button
                type="button"
                onClick={() => void loadApplicants()}
                className="cursor-pointer rounded-full bg-[var(--school-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--school-brand-hover)]"
              >
                Search
              </button>
              {selectedIds.size > 0 ? (
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B91C1C]"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete ({selectedIds.size})
                </button>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-3xl border border-[#E5E7EB] bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
                    <tr>
                      <th className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={
                            applications.length > 0 &&
                            applications.every((a) => selectedIds.has(a.id))
                          }
                          onChange={toggleSelectAllVisible}
                          className="h-4 w-4 cursor-pointer rounded border-[#CBD5E1] text-[var(--school-brand)]"
                          aria-label="Select all applicants"
                        />
                      </th>
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Programme</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((a) => {
                      const programmeCount = a.programmes?.length || (a.programme ? 1 : 0);
                      return (
                      <tr
                        key={a.id}
                        className={`border-t border-[#F3F4F6] ${
                          selectedIds.has(a.id) ? "bg-[#FEF2F2]/40" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(a.id)}
                            onChange={() => toggleSelectId(a.id)}
                            className="h-4 w-4 cursor-pointer rounded border-[#CBD5E1] text-[var(--school-brand)]"
                            aria-label={`Select ${a.fullName}`}
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {a.applicationNumber}
                        </td>
                        <td className="px-4 py-3 font-medium">{a.fullName}</td>
                        <td className="px-4 py-3">{a.phone || "—"}</td>
                        <td className="px-4 py-3">{a.email}</td>
                        <td className="px-4 py-3">
                          {programmeCount}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelected(a)}
                              aria-label={`View ${a.fullName}'s application`}
                              title="View application"
                              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--school-brand)] px-3.5 text-[11px] font-semibold text-white shadow-sm shadow-[var(--school-brand)]/20 transition hover:-translate-y-0.5 hover:bg-[var(--school-brand-hover)] hover:shadow-md hover:shadow-[var(--school-brand)]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--school-brand)] focus-visible:ring-offset-2"
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                    })}
                    {!loading && applications.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-[#6B7280]">
                          {tab === "accepted"
                            ? "No accepted students yet."
                            : tab === "declined"
                              ? "No declined students yet."
                              : "No applications yet."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {tab === "programmes" && (
          <ProgrammesSection slug={slug} onError={setError} />
        )}

        {tab === "blog" && (
          <BlogSection
            slug={slug}
            schoolId={schoolId}
            schoolName={schoolAlias || schoolName}
            onError={setError}
          />
        )}

        {tab === "transactions" && (
          <section className="overflow-hidden rounded-3xl border border-[#E5E7EB] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
                  <tr>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Buyer</th>
                    <th className="px-4 py-3">Level</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id} className="border-t border-[#F3F4F6]">
                      <td className="px-4 py-3 font-mono text-xs">{t.reference}</td>
                      <td className="px-4 py-3">
                        <div>{t.fullName || "—"}</div>
                        <div className="text-xs text-[#6B7280]">{t.email}</div>
                      </td>
                      <td className="px-4 py-3 capitalize">
                        {t.programmeLevel === "postgraduate"
                          ? "Postgraduate"
                          : "Undergraduate"}
                      </td>
                      <td className="px-4 py-3">{t.product}</td>
                      <td className="px-4 py-3">GHS {t.amount}</td>
                      <td className="px-4 py-3">{t.status}</td>
                      <td className="px-4 py-3 text-xs">
                        {t.paidAt ? new Date(t.paidAt).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                  {!loading && transactions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-[#6B7280]">
                        No transactions yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "analytics" && (
          loading && !analytics ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--school-brand)]" />
            </div>
          ) : analytics ? (
            <AnalyticsSection analytics={analytics} brandColor={brandColor} />
          ) : (
            <p className="rounded-3xl border border-[#E5E7EB] bg-white px-6 py-10 text-center text-sm text-[#6B7280]">
              Could not load analytics.
            </p>
          )
        )}

        {tab === "settings" && (
          <SettingsSection
            slug={slug}
            deadline={schoolDeadline}
            brandColor={brandColor}
            brandColors={brandColors}
            voucherPrice={voucherPrice}
            undergraduateVoucherPrice={undergraduateVoucherPrice}
            postgraduateVoucherPrice={postgraduateVoucherPrice}
            description={schoolDescription}
            onError={setError}
            onSaved={(school) => {
              setSchoolDeadline(school.deadline);
              setBrandColor(school.brandColor);
              setBrandColors(school.brandColors);
              setVoucherPrice(school.voucherPrice);
              setUndergraduateVoucherPrice(school.undergraduateVoucherPrice);
              setPostgraduateVoucherPrice(school.postgraduateVoucherPrice);
              setSchoolDescription(school.description);
            }}
          />
        )}
      </div>

      {selected && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setSelected(null)}
          />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-4xl flex-col bg-[#F8FAFC] shadow-xl">
            <div className="flex items-center justify-between border-b bg-white px-5 py-4">
              <div>
                <h2 className="font-semibold">{selected.fullName}</h2>
                <p className="text-xs text-[#6B7280]">
                  {selected.applicationNumber} · {selected.status}
                </p>
              </div>
              <button type="button" onClick={() => setSelected(null)}>
                <XCircle className="h-5 w-5 text-[#9CA3AF]" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
              <ApplicationPrintout
                school={printoutSchool}
                data={printoutFromDetail(selected, selected.programmes)}
              />
              <div className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
                <ApplicationDocuments
                  documents={selected.documents}
                  applicationNumber={selected.applicationNumber}
                />
              </div>
            </div>
            <div className="border-t border-[#E8EEF5] bg-gradient-to-b from-[#F8FAFC] to-white px-4 py-4 sm:px-5">
              {selected.offerResponse === "accepted" ||
              selected.offerResponse === "declined" ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-[#E5E7EB] bg-white px-3.5 py-3">
                    <p className="text-xs font-medium text-[#64748B]">
                      This student has already{" "}
                      <span className="font-semibold text-[#0F172A]">
                        {selected.offerResponse === "accepted"
                          ? "accepted"
                          : "declined"}
                      </span>{" "}
                      the admission offer. Status can no longer be changed.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={downloadingPdf}
                    onClick={downloadSelected}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E2E8F0] bg-white px-4 py-2.5 text-xs font-semibold text-[#334155] shadow-sm transition hover:border-[#CBD5E1] hover:bg-[#F8FAFC] disabled:opacity-60"
                  >
                    {downloadingPdf ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    {downloadingPdf ? "Preparing PDF…" : "Download PDF"}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
                        Application actions
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#64748B]">
                        Status changes email the student and update their portal.
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${studentStatusBadgeClass(selected.status)}`}
                    >
                      {studentStatusCopy(selected.status).badge}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void updateStatus(selected.id, "Under Review")
                      }
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-2 text-xs font-semibold text-sky-800 shadow-sm transition hover:bg-sky-100"
                    >
                      <ClipboardList className="h-3.5 w-3.5" />
                      Under Review
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateStatus(selected.id, "Approved")}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-100"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => openRejectModal(selected)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-800 shadow-sm transition hover:bg-rose-100"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => openAdmitModal(selected)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#007AFF] px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-[#007AFF]/25 transition hover:bg-[#0066D6]"
                    >
                      <GraduationCap className="h-3.5 w-3.5" />
                      Admit
                    </button>
                    <div
                      className="mx-0.5 hidden h-8 w-px self-center bg-[#E2E8F0] sm:block"
                      aria-hidden
                    />
                    <button
                      type="button"
                      disabled={downloadingPdf}
                      onClick={downloadSelected}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-semibold text-[#475569] shadow-sm transition hover:border-[#CBD5E1] hover:bg-[#F8FAFC] disabled:opacity-60"
                    >
                      {downloadingPdf ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      {downloadingPdf ? "Preparing PDF…" : "Download PDF"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      {admitTarget && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={() => !admitBusy && setAdmitTarget(null)}
          />
          <div className="fixed left-1/2 top-1/2 z-[70] w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[#0F172A]">
              Admit student
            </h3>
            <p className="mt-1 text-sm text-[#64748B]">
              Select the programme {admitTarget.fullName} qualifies for, then
              confirm. The student will be emailed and asked to accept or
              decline.
            </p>
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-[#64748B]">
              Programme
            </label>
            {(admitTarget.programmes || []).length > 0 || admitTarget.programme ? (
              <select
                value={admitProgramme}
                onChange={(e) => setAdmitProgramme(e.target.value)}
                className="mt-1.5 w-full cursor-pointer rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--school-brand)]"
              >
                <option value="">Select programme…</option>
                {(admitTarget.programmes || []).map((p) => (
                  <option key={`${p.rank}-${p.display}`} value={p.display}>
                    {p.label}: {p.display}
                  </option>
                ))}
                {admitTarget.programme &&
                !(admitTarget.programmes || []).some(
                  (p) => p.display === admitTarget.programme,
                ) ? (
                  <option value={admitTarget.programme}>
                    {admitTarget.programme}
                  </option>
                ) : null}
              </select>
            ) : (
              <input
                value={admitProgramme}
                onChange={(e) => setAdmitProgramme(e.target.value)}
                placeholder="Enter programme name"
                className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--school-brand)]"
              />
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={admitBusy}
                onClick={() => setAdmitTarget(null)}
                className="cursor-pointer rounded-full border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#334155] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={admitBusy || !admitProgramme.trim()}
                onClick={() => void confirmAdmit()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#007AFF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {admitBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Confirm admit
              </button>
            </div>
          </div>
        </>
      )}
      {rejectTarget && (
        <>
          <div
            className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-[1px]"
            onClick={() => !rejectBusy && setRejectTarget(null)}
          />
          <div className="fixed left-1/2 top-1/2 z-[90] w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-[#FECACA] bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FEF2F2] text-[#DC2626]">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-[#0F172A]">
              Reject this application?
            </h3>
            <p className="mt-1 text-sm font-medium text-[#334155]">
              {rejectTarget.fullName}
            </p>
            <p className="text-xs text-[#64748B]">
              {rejectTarget.applicationNumber}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[#475569]">
              The student will get a supportive update that a place isn’t
              available this round — by email and in their TertiaryGuide portal.
            </p>
            <p className="mt-3 rounded-2xl border border-[#FED7AA] bg-[#FFF7ED] px-3 py-2.5 text-sm leading-relaxed text-[#9A3412]">
              This does not delete their application. You can still change the
              status later if needed.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={rejectBusy}
                onClick={() => setRejectTarget(null)}
                className="cursor-pointer rounded-full border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#334155] disabled:opacity-50"
              >
                Keep reviewing
              </button>
              <button
                type="button"
                disabled={rejectBusy}
                onClick={() => void confirmReject()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50"
              >
                {rejectBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Yes, reject application
              </button>
            </div>
          </div>
        </>
      )}

      {deleteConfirmOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/45"
            onClick={() => !deleteBusy && setDeleteConfirmOpen(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-[70] w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-[#FECACA] bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FEF2F2] text-[#DC2626]">
              <Trash2 className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-[#0F172A]">
              Delete {selectedIds.size} applicant
              {selectedIds.size === 1 ? "" : "s"}?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#475569]">
              Please be careful. Once deleted from your school portal, these
              applications{" "}
              <strong className="text-[#B91C1C]">
                will no longer appear here and you cannot retrieve them yourself
              </strong>
              .
            </p>
            <p className="mt-3 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2.5 text-sm leading-relaxed text-[#92400E]">
              TertiaryGuide keeps a secure backup. Only the main TertiaryGuide
              admin can restore deleted applicants back into your portal.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setDeleteConfirmOpen(false)}
                className="cursor-pointer rounded-full border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#334155] disabled:opacity-50"
              >
                Keep applicants
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => void confirmDeleteSelected()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50"
              >
                {deleteBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Yes, delete permanently
              </button>
            </div>
          </div>
        </>
      )}

      {statusNotice ? (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[120] flex justify-center px-4">
          <div
            role="status"
            className="pointer-events-auto flex max-w-lg items-start gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-900 shadow-lg shadow-emerald-900/10"
          >
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <p className="min-w-0 flex-1 font-medium leading-snug">
              {statusNotice}
            </p>
            <button
              type="button"
              onClick={() => setStatusNotice(null)}
              className="shrink-0 rounded-full p-0.5 text-emerald-700/70 hover:bg-emerald-50 hover:text-emerald-900"
              aria-label="Dismiss"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
