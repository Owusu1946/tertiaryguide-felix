"use client";

import Image from "next/image";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  FileText,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  LineChart,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  Newspaper,
  Package,
  Compass,
  School,
  Settings,
  ShieldCheck,
  ArrowUpRight,
  UserCog,
  Users,
  X,
} from "lucide-react";
import AdminFormsSection from "./AdminFormsSection";
import { AdminAnalyticsSection } from "./AdminAnalyticsSection";
import { AdminBlogSection } from "./AdminBlogSection";
import { AdminUsersSection } from "./AdminUsersSection";
import { AdminCheckersSection } from "./AdminCheckersSection";
import { AdminAssistanceSection } from "./AdminAssistanceSection";
import { AdminAdsSection } from "./AdminAdsSection";
import { AdminAdReportsSection } from "./AdminAdReportsSection";
import { AdminFormRequestsSection } from "./AdminFormRequestsSection";
import { AdminStaffSection } from "./AdminStaffSection";
import { AdminPartnerSchoolsSection } from "./AdminPartnerSchoolsSection";
import { AdminPartnerVouchersSection } from "./AdminPartnerVouchersSection";
import { AdminExploreSection } from "./AdminExploreSection";
import { AdminEmailCampaignsSection } from "./AdminEmailCampaignsSection";
import {
  AdminSettingsSection,
  type SettingsTab,
} from "./AdminSettingsSection";
import { AdminManageSchoolsSection } from "./AdminManageSchoolsSection";
import { NotificationInbox } from "@/app/components/NotificationInbox";
import {
  ADMIN_NOTIFICATIONS_KEY,
  resolveAdminNotificationSection,
  type AdminNotification,
} from "@/lib/notifications";

type AdminSection =
  | "dashboard"
  | "forms"
  | "manageSchools"
  | "partnerSchools"
  | "partnerVouchers"
  | "analytics"
  | "users"
  | "checkers"
  | "assistance"
  | "formRequests"
  | "blog"
  | "explore"
  | "ads"
  | "adReports"
  | "emailCampaigns"
  | "settings"
  | "staff";

const baseMetrics = [
  {
    id: 1,
    label: "Total Voucher Orders",
    period: "All time",
    description: "All paid university voucher orders",
    tone: "blue" as const,
    value: "—",
    section: "forms" as AdminSection,
    cta: "Open Forms",
  },
  {
    id: 2,
    label: "Unissued Vouchers",
    period: "Current",
    description: "Paid voucher orders still awaiting codes",
    tone: "red" as const,
    value: "—",
    section: "forms" as AdminSection,
    cta: "Process stock",
  },
  {
    id: 3,
    label: "Issued Vouchers",
    period: "All time",
    description: "Voucher orders already fulfilled",
    tone: "green" as const,
    value: "—",
    section: "forms" as AdminSection,
    cta: "View issued",
  },
];

const initialUnservedForms: {
  id: string;
  school: string;
  name: string;
  date: string;
}[] = [];

function periodBadge(period: string) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-medium text-[#2563EB]">
      {period}
    </span>
  );
}

function toneDot(tone: "blue" | "red" | "green") {
  const config: Record<
    "blue" | "red" | "green",
    { bg: string; icon: React.ComponentType<{ className?: string }>; iconColor: string }
  > = {
    blue: { bg: "bg-[#DBEAFE]", icon: Package, iconColor: "text-[#2563EB]" },
    red: { bg: "bg-[#FEE2E2]", icon: AlertTriangle, iconColor: "text-[#DC2626]" },
    green: { bg: "bg-[#DCFCE7]", icon: Users, iconColor: "text-[#16A34A]" },
  };

  const { bg, icon: Icon, iconColor } = config[tone];

  return (
    <span
      className={`mr-3 inline-flex h-9 w-9 items-center justify-center rounded-2xl ${bg}`}
    >
      <Icon className={`h-4 w-4 ${iconColor}`} />
    </span>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const [adminName, setAdminName] = useState<string | null>(null);
  const [adminRole, setAdminRole] = useState<"admin" | "superadmin" | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("account");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [adminNotifications, setAdminNotifications] = useState<
    AdminNotification[]
  >([]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("tg_admin_sidebar_collapsed");
      if (stored === "1") setSidebarCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "tg_admin_sidebar_collapsed",
        sidebarCollapsed ? "1" : "0",
      );
    } catch {
      // ignore
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileSidebarOpen]);
  useEffect(() => {
    async function checkAuth() {
      try {
        const stored =
          typeof window !== "undefined"
            ? window.localStorage.getItem("tg_admin_username")
            : null;
        const storedRole =
          typeof window !== "undefined"
            ? window.localStorage.getItem("tg_admin_role")
            : null;

        if (!stored) {
          const res = await fetch("/api/admin/setup/status");
          const data = await res.json();
          if (res.ok && data.needsSetup) {
            router.replace("/admin/setup");
            return;
          }
          router.replace("/admin/signin");
          return;
        }

        if (storedRole === "school_admin") {
          const schoolSlug =
            typeof window !== "undefined"
              ? window.localStorage.getItem("tg_school_slug")
              : null;
          router.replace(schoolSlug ? `/admin/${schoolSlug}` : "/admin/signin");
          return;
        }

        setAdminName(stored);
        setAdminRole(storedRole === "superadmin" ? "superadmin" : "admin");
      } finally {
        setCheckingAuth(false);
      }
    }

    void checkAuth();
  }, [router]);

  useEffect(() => {
    if (adminRole !== "superadmin" && activeSection === "staff") {
      setActiveSection("dashboard");
    }
  }, [adminRole, activeSection]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load(initial: boolean) {
      if (initial) {
        setFormsLoading(true);
        setFormsError(null);
      }

      try {
        const [res, metricsRes] = await Promise.all([
          fetch("/api/admin/forms"),
          fetch("/api/admin/analytics/forms"),
        ]);
        const [data, metricsData] = await Promise.all([res.json(), metricsRes.json()]);

        if (!res.ok || !metricsRes.ok) {
          if (initial) {
            setFormsError(
              data?.error ||
                metricsData?.error ||
                "Could not load voucher overview. Please try again.",
            );
          }
          return;
        }

        if (cancelled) return;

        const forms: {
          id?: string;
          status?: string;
          name?: string;
          school?: string;
          date?: string;
        }[] = Array.isArray(data.forms) ? data.forms : [];

        setFormsTotal(
          typeof metricsData.voucherTotal === "number" ? metricsData.voucherTotal : null,
        );
        setFormsIssued(
          typeof metricsData.voucherIssued === "number" ? metricsData.voucherIssued : null,
        );
        setFormsUnissued(
          typeof metricsData.voucherUnissued === "number"
            ? metricsData.voucherUnissued
            : null,
        );
        setCheckerTotal(
          typeof metricsData.checkerTotal === "number" ? metricsData.checkerTotal : null,
        );

        const unissuedRows = forms
          .filter((f) => f.status === "Unissued")
          .slice(0, 6)
          .map((f) => {
            const rawDate = f.date;
            let formattedDate = "—";
            if (typeof rawDate === "string") {
              const d = new Date(rawDate);
              formattedDate = Number.isNaN(d.getTime())
                ? rawDate
                : d.toLocaleDateString("en-US", {
                    month: "short",
                    day: "2-digit",
                    year: "numeric",
                  });
            }

            return {
              id: typeof f.id === "string" ? f.id : `${f.name}-${formattedDate}`,
              school: (f.school ?? "—").trim() || "—",
              name: f.name || "Unknown buyer",
              date: formattedDate,
            };
          });

        setUnservedForms(unissuedRows);
      } catch {
        if (!cancelled && initial) {
          setFormsError("Could not load voucher overview. Please try again.");
        }
      } finally {
        if (!cancelled && initial) {
          setFormsLoading(false);
        }
      }
    }

    void load(true);

    const id = window.setInterval(() => {
      void load(false);
    }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const loadAdminNotifications = () => {
      try {
        if (typeof window === "undefined") return;
        const raw = window.localStorage.getItem(ADMIN_NOTIFICATIONS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        setAdminNotifications(Array.isArray(parsed) ? parsed : []);
      } catch {
        setAdminNotifications([]);
      }
    };

    loadAdminNotifications();

    const handleUpdated = () => {
      loadAdminNotifications();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === ADMIN_NOTIFICATIONS_KEY) {
        loadAdminNotifications();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener(
        "tg-admin-notifications-updated",
        handleUpdated as EventListener,
      );
      window.addEventListener("storage", handleStorage as EventListener);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(
          "tg-admin-notifications-updated",
          handleUpdated as EventListener,
        );
        window.removeEventListener(
          "storage",
          handleStorage as EventListener,
        );
      }
    };
  }, []);

  const VOUCHER_NOTIF_CURSOR_KEY = "tg_admin_voucher_notif_paidat_cursor";

  // Poll form voucher purchases (MongoDB) so the admin panel updates without relying on the buyer’s browser.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (checkingAuth) return;
    if (!adminName) return;

    let cancelled = false;

    const syncVoucherPurchaseNotifications = async () => {
      try {
        const res = await fetch("/api/admin/forms/payments");
        const data = (await res.json()) as {
          ok?: boolean;
          payments?: {
            id: string;
            reference: string;
            email: string;
            fullName: string | null;
            school: string;
            paidAt: string;
            voucherPending?: boolean;
            amount: number;
          }[];
        };

        if (cancelled || !data?.ok || !Array.isArray(data.payments)) return;

        const payments = data.payments;
        if (payments.length === 0) return;

        const cursor = localStorage.getItem(VOUCHER_NOTIF_CURSOR_KEY);
        if (cursor === null) {
          localStorage.setItem(VOUCHER_NOTIF_CURSOR_KEY, payments[0].paidAt);
          return;
        }

        const newOnes = payments.filter((p) => p.paidAt > cursor!);
        if (newOnes.length === 0) return;

        const items: AdminNotification[] = newOnes.map((p) => {
          const amountGhs = (p.amount / 100).toFixed(2);
          const notifId = `voucher-form-${p.reference}`;
          const who = p.fullName ? `${p.fullName} <${p.email}>` : p.email;
          if (p.voucherPending) {
            return {
              id: notifId,
              title: "New form voucher order (queued)",
              body: `${who} — ${p.school} · GHS ${amountGhs} (ref: ${p.reference}). Awaiting stock; fulfill when a voucher is available.`,
              read: false,
              createdAt: p.paidAt,
              section: "forms",
            };
          }
          return {
            id: notifId,
            title: "New form voucher purchase",
            body: `${who} — ${p.school} · GHS ${amountGhs} (ref: ${p.reference}). Voucher has been sent by email.`,
            read: false,
            createdAt: p.paidAt,
            section: "forms",
          };
        });

        const newestPaidAt = payments[0].paidAt;
        localStorage.setItem(VOUCHER_NOTIF_CURSOR_KEY, newestPaidAt);

        setAdminNotifications((current) => {
          const existingIds = new Set(current.map((n) => n.id));
          const toPrepend = items.filter((n) => !existingIds.has(n.id));
          if (toPrepend.length === 0) return current;
          const next = [...toPrepend, ...current];
          try {
            window.localStorage.setItem(
              ADMIN_NOTIFICATIONS_KEY,
              JSON.stringify(next),
            );
          } catch {
            // ignore
          }
          return next;
        });
        window.dispatchEvent(new CustomEvent("tg-admin-notifications-updated"));
      } catch {
        // ignore
      }
    };

    void syncVoucherPurchaseNotifications();
    const interval = window.setInterval(syncVoucherPurchaseNotifications, 12000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [checkingAuth, adminName]);

  const updateAdminNotifications = (
    updater: (
      current: typeof adminNotifications,
    ) => typeof adminNotifications,
  ) => {
    if (typeof window === "undefined") return;

    setAdminNotifications((current) => {
      const next = updater(current);
      window.localStorage.setItem(
        ADMIN_NOTIFICATIONS_KEY,
        JSON.stringify(next),
      );
      return next;
    });

    window.dispatchEvent(new CustomEvent("tg-admin-notifications-updated"));
  };

  const unreadAdminCount = adminNotifications.filter((n) => !n.read).length;

  const openAdminNotification = (item: { id: string }) => {
    const match = adminNotifications.find((n) => n.id === item.id);
    if (!match) return;
    updateAdminNotifications((current) =>
      current.map((n) => (n.id === match.id ? { ...n, read: true } : n)),
    );
    setNotificationsOpen(false);
    const section = resolveAdminNotificationSection(match);
    if (
      section === "applications" ||
      section === "deletedApplications" ||
      section === "activityLogs"
    ) {
      setSettingsTab(section as SettingsTab);
      setActiveSection("settings");
      return;
    }
    setActiveSection(section as AdminSection);
  };

  const [visitorsLoading, setVisitorsLoading] = useState(true);
  const [visitorsError, setVisitorsError] = useState<string | null>(null);
  const [totalVisits7d, setTotalVisits7d] = useState<number | null>(null);
  const [uniqueVisitors7d, setUniqueVisitors7d] = useState<number | null>(null);

  const [formsTotal, setFormsTotal] = useState<number | null>(null);
  const [formsIssued, setFormsIssued] = useState<number | null>(null);
  const [formsUnissued, setFormsUnissued] = useState<number | null>(null);
  const [checkerTotal, setCheckerTotal] = useState<number | null>(null);
  const [formsLoading, setFormsLoading] = useState(true);
  const [formsError, setFormsError] = useState<string | null>(null);
  const [unservedForms, setUnservedForms] = useState<typeof initialUnservedForms>(
    initialUnservedForms,
  );

  useEffect(() => {
    let cancelled = false;

    async function load(initial: boolean) {
      if (initial) {
        setVisitorsLoading(true);
        setVisitorsError(null);
      }

      try {
        const res = await fetch("/api/admin/analytics/visits");
        const data = await res.json();

        if (!res.ok) {
          if (initial) {
            setVisitorsError(
              data?.error || "Could not load visitors. Please try again.",
            );
          }
          return;
        }

        if (!cancelled) {
          setTotalVisits7d(
            typeof data.totalVisits7d === "number" ? data.totalVisits7d : null,
          );
          setUniqueVisitors7d(
            typeof data.uniqueVisitors7d === "number"
              ? data.uniqueVisitors7d
              : null,
          );
        }
      } catch {
        if (!cancelled && initial) {
          setVisitorsError("Could not load visitors. Please try again.");
        }
      } finally {
        if (!cancelled && initial) {
          setVisitorsLoading(false);
        }
      }
    }

    load(true);

    const id = window.setInterval(() => {
      load(false);
    }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const handleLogout = () => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("tg_admin_username");
        window.localStorage.removeItem("tg_admin_role");
      }
    } catch {
      // ignore storage errors
    }

    router.replace("/admin/signin");
  };

  const formattedDate = now.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    weekday: "short",
  });

  const formattedTime = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit", // includes seconds
    hour12: false,
  });

  if (checkingAuth) {
    return null;
  }

  const metrics = baseMetrics.map((metric) => {
    if (metric.label === "Total Voucher Orders") {
      return {
        ...metric,
        value: formsTotal !== null ? formsTotal.toString() : "—",
      };
    }

    if (metric.label === "Unissued Vouchers") {
      return {
        ...metric,
        value: formsUnissued !== null ? formsUnissued.toString() : "—",
      };
    }

    if (metric.label === "Issued Vouchers") {
      return {
        ...metric,
        value: formsIssued !== null ? formsIssued.toString() : "—",
      };
    }

    return metric;
  });

  const adminNavItems: {
    id: AdminSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    superadminOnly?: boolean;
  }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "forms", label: "Forms", icon: FileText },
    { id: "manageSchools", label: "Manage schools", icon: School },
    { id: "partnerSchools", label: "Partner schools", icon: Building2 },
    { id: "partnerVouchers", label: "Partner vouchers", icon: Package },
    { id: "formRequests", label: "Form requests", icon: ClipboardList },
    { id: "users", label: "Users", icon: Users },
    { id: "checkers", label: "Checkers", icon: ShieldCheck },
    { id: "assistance", label: "Assistance", icon: HelpCircle },
    { id: "blog", label: "Blog", icon: Newspaper },
    { id: "explore", label: "Explore", icon: Compass },
    { id: "ads", label: "Ads", icon: Megaphone },
    { id: "adReports", label: "Ad reports", icon: LineChart },
    { id: "emailCampaigns", label: "Email campaigns", icon: Mail },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "staff", label: "Admin team", icon: UserCog, superadminOnly: true },
  ];

  const visibleNavItems = adminNavItems.filter(
    (item) => !item.superadminOnly || adminRole === "superadmin",
  );

  const selectSection = (id: AdminSection) => {
    if (id === "settings") {
      setSettingsTab("account");
    }
    setActiveSection(id);
    setMobileSidebarOpen(false);
  };

  const openSettingsTab = (tab: SettingsTab) => {
    setSettingsTab(tab);
    setActiveSection("settings");
    setMobileSidebarOpen(false);
  };

  const activeNavLabel =
    visibleNavItems.find((item) => item.id === activeSection)?.label ||
    "Dashboard";

  return (
    <main className="min-h-screen bg-[#F3F4F6] text-[#050816]">
      {mobileSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px] lg:hidden"
          aria-label="Close sidebar"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[#BFDBFE] bg-gradient-to-b from-[#EAF4FF] via-white to-[#F8FBFF] shadow-sm transition-all duration-200 ease-out ${
          sidebarCollapsed ? "lg:w-[4.5rem]" : "lg:w-64"
        } w-64 ${
          mobileSidebarOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        }`}
        aria-label="Admin sidebar"
      >
        <div
          className={`border-b border-[#DBEAFE] px-3 py-3 ${
            sidebarCollapsed ? "lg:px-2" : ""
          }`}
        >
          <div
            className={`flex items-start gap-2 ${
              sidebarCollapsed ? "lg:flex-col lg:items-center" : ""
            }`}
          >
            <div
              className={`min-w-0 flex-1 ${
                sidebarCollapsed ? "lg:flex lg:flex-col lg:items-center" : ""
              }`}
            >
              <div
                className={`inline-flex items-center rounded-xl bg-white px-2 py-1 shadow-sm ring-1 ring-[#DBEAFE] ${
                  sidebarCollapsed ? "lg:mx-auto" : ""
                }`}
              >
                <Image
                  src="/hero/logoTguide.png"
                  alt="TertiaryGuide"
                  width={96}
                  height={22}
                  className={`h-4 w-auto ${
                    sidebarCollapsed ? "lg:h-5 lg:w-5 lg:object-contain" : ""
                  }`}
                />
              </div>

              {adminRole === "superadmin" && (
                <div
                  className={`mt-2 ${sidebarCollapsed ? "lg:hidden" : ""}`}
                >
                  <span className="inline-flex rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#92400E]">
                    Superadmin
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#BFDBFE] bg-white text-[#0F172A] hover:bg-[#EFF6FF] lg:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="mt-0.5 hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#BFDBFE] bg-white text-[#0F172A] hover:bg-[#EFF6FF] lg:inline-flex"
              aria-label={
                sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
              }
              title={
                sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
              }
            >
              {sidebarCollapsed ? (
                <ChevronsRight className="h-4 w-4" />
              ) : (
                <ChevronsLeft className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <nav
          className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3"
          aria-label="Admin sections"
        >
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectSection(item.id)}
                title={item.label}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition ${
                  sidebarCollapsed ? "lg:justify-center lg:px-2" : ""
                } ${
                  active
                    ? "bg-[#007AFF] text-white shadow-sm"
                    : "text-[#4B5563] hover:bg-white hover:text-[#007AFF]"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span
                  className={`truncate ${
                    sidebarCollapsed ? "lg:hidden" : ""
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div
          className={`border-t border-[#DBEAFE] p-2 ${
            sidebarCollapsed ? "lg:px-1.5" : ""
          }`}
        >
          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-[#4B5563] hover:bg-white hover:text-[#DC2626] ${
              sidebarCollapsed ? "lg:justify-center lg:px-2" : ""
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={sidebarCollapsed ? "lg:hidden" : ""}>Logout</span>
          </button>
        </div>
      </aside>

      <div
        className={`min-h-screen transition-[padding] duration-200 ease-out ${
          sidebarCollapsed ? "lg:pl-[4.5rem]" : "lg:pl-64"
        }`}
      >
        <header className="sticky top-0 z-30 border-b border-[#BFDBFE] bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#BFDBFE] bg-white text-[#0F172A] hover:bg-[#EFF6FF] lg:hidden"
                aria-label="Open sidebar"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#050816] sm:text-base">
                  {activeNavLabel}
                </p>
                <p className="hidden truncate text-xs text-[#6B7280] sm:block">
                  {adminName ? `Signed in as ${adminName}` : "TertiaryGuide Admin"}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setSidebarCollapsed((v) => !v)}
                className="hidden h-9 w-9 items-center justify-center rounded-full border border-[#BFDBFE] bg-white text-[#0F172A] hover:bg-[#EFF6FF] lg:inline-flex"
                aria-label={
                  sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
                }
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {sidebarCollapsed ? (
                  <ChevronsRight className="h-4 w-4" />
                ) : (
                  <ChevronsLeft className="h-4 w-4" />
                )}
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#BFDBFE] bg-white text-[#0F172A] hover:bg-[#EFF6FF]"
                  aria-label="Admin notifications"
                >
                  <Bell className="h-4 w-4" />
                </button>
                {unreadAdminCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-[#EF4444] px-0.5 text-[9px] font-semibold text-white shadow-sm">
                    {unreadAdminCount}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#BFDBFE] bg-white px-2.5 py-1.5 text-xs font-medium text-[#0F172A] hover:bg-[#EFF6FF] sm:px-3 sm:text-sm"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto flex min-w-0 max-w-7xl flex-col gap-6 px-4 py-4 sm:gap-8 sm:px-6 sm:py-6 md:px-8">
        {/* content start */}
        {activeSection === "dashboard" ? (
          <>
            <section className="relative overflow-hidden rounded-[1.75rem] border border-[#BFDBFE] bg-[#007AFF] px-5 py-6 text-white shadow-sm sm:px-7">
              <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 12% 20%, rgba(255,255,255,0.35), transparent 42%), radial-gradient(circle at 88% 10%, rgba(255,255,255,0.18), transparent 34%)",
                }}
              />
              <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/70">
                    Overview
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
                    {`Welcome back, ${adminName || "Admin"}`}
                  </h1>
                  <p className="mt-2 max-w-xl text-sm text-white/85">
                    {formattedDate} · {formattedTime}. Jump into the areas that
                    need attention or open a shortcut below.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => selectSection("forms")}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#007AFF] shadow-sm hover:bg-[#F0F7FF]"
                  >
                    Open Forms
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => selectSection("analytics")}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20"
                  >
                    Analytics
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </section>

            <section className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <button
                  key={metric.id}
                  type="button"
                  onClick={() => selectSection(metric.section)}
                  className="group flex min-h-[10.5rem] flex-col justify-between rounded-[1.5rem] border border-[#D7E6F8] bg-white p-5 text-left shadow-[0_10px_30px_-18px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:border-[#93C5FD] hover:shadow-[0_18px_36px_-20px_rgba(37,99,235,0.45)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    {toneDot(metric.tone)}
                    {periodBadge(metric.period)}
                  </div>
                  <div className="mt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                      {metric.label}
                    </p>
                    <p className="mt-1 text-3xl font-semibold tracking-tight text-[#0F172A]">
                      {metric.value}
                    </p>
                    <p className="mt-1 text-xs text-[#94A3B8]">
                      {metric.description}
                    </p>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#007AFF] group-hover:gap-1.5">
                    {metric.cta}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => selectSection("analytics")}
                className="group flex min-h-[10.5rem] flex-col justify-between rounded-[1.5rem] border border-[#D7E6F8] bg-white p-5 text-left shadow-[0_10px_30px_-18px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:border-[#93C5FD] hover:shadow-[0_18px_36px_-20px_rgba(37,99,235,0.45)]"
              >
                <div className="flex items-start justify-between gap-3">
                  {toneDot("blue")}
                  {periodBadge("7 days")}
                </div>
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                    Visitors
                  </p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight text-[#0F172A]">
                    {visitorsLoading
                      ? "..."
                      : uniqueVisitors7d !== null
                        ? uniqueVisitors7d
                        : totalVisits7d !== null
                          ? totalVisits7d
                          : "—"}
                  </p>
                  {visitorsError ? (
                    <p className="mt-1 text-xs text-[#DC2626]">{visitorsError}</p>
                  ) : (
                    <p className="mt-1 text-xs text-[#94A3B8]">
                      {totalVisits7d !== null
                        ? `${totalVisits7d} page views tracked`
                        : "Unique visitors in the last 7 days"}
                    </p>
                  )}
                </div>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#007AFF] group-hover:gap-1.5">
                  Open Analytics
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </button>
            </section>

            <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-[1.5rem] border border-[#D7E6F8] bg-white shadow-[0_10px_30px_-18px_rgba(15,23,42,0.35)]">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EAF2FB] px-5 py-4">
                  <div>
                    <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#FEE2E2] text-[#DC2626]">
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                      Needs fulfilment
                    </h2>
                    <p className="mt-1 text-xs text-[#64748B]">
                      Latest paid voucher orders still waiting for codes
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectSection("forms")}
                    className="inline-flex items-center gap-1 rounded-full border border-[#BFDBFE] bg-[#F8FBFF] px-3 py-1.5 text-xs font-semibold text-[#007AFF] hover:bg-[#EFF6FF]"
                  >
                    Manage in Forms
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="px-5 py-3">
                  <div className="grid grid-cols-[1.3fr_1fr_0.8fr] gap-2 px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-[#7C93B0]">
                    <span>School</span>
                    <span>Buyer</span>
                    <span className="text-right">Date</span>
                  </div>
                  <div className="divide-y divide-[#EEF4FF]">
                    {formsLoading ? (
                      <p className="px-2 py-4 text-sm text-[#64748B]">
                        Loading voucher orders...
                      </p>
                    ) : formsError ? (
                      <p className="px-2 py-4 text-sm text-[#DC2626]">{formsError}</p>
                    ) : unservedForms.length === 0 ? (
                      <p className="px-2 py-4 text-sm text-[#64748B]">
                        No unissued vouchers at the moment.
                      </p>
                    ) : (
                      unservedForms.slice(0, 6).map((row) => (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => selectSection("forms")}
                          className="grid w-full grid-cols-[1.3fr_1fr_0.8fr] gap-2 rounded-xl px-2 py-3 text-left text-sm transition hover:bg-[#F8FBFF]"
                        >
                          <span
                            className="min-w-0 truncate font-medium text-[#0F172A]"
                            title={row.school}
                          >
                            {row.school}
                          </span>
                          <span
                            className="min-w-0 truncate text-[#475569]"
                            title={row.name}
                          >
                            {row.name}
                          </span>
                          <span className="text-right text-[#94A3B8]">
                            {row.date}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-[#D7E6F8] bg-white p-5 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.35)]">
                <div>
                  <h2 className="text-sm font-semibold text-[#0F172A]">
                    Quick shortcuts
                  </h2>
                  <p className="mt-1 text-xs text-[#64748B]">
                    Jump straight into common admin tasks
                  </p>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      {
                        id: "forms" as AdminSection,
                        label: "Forms & stock",
                        hint: "Orders and fulfilment",
                        icon: FileText,
                      },
                      {
                        id: "manageSchools" as AdminSection,
                        label: "Manage schools",
                        hint: "Prices and programmes",
                        icon: School,
                      },
                      {
                        id: "partnerSchools" as AdminSection,
                        label: "Partner schools",
                        hint: "Secured school portals",
                        icon: Building2,
                      },
                      {
                        id: "applications" as const,
                        label: "Applications",
                        hint: "Review student apps",
                        icon: GraduationCap,
                        settingsTab: "applications" as SettingsTab,
                      },
                      {
                        id: "checkers" as AdminSection,
                        label: "WASSCE checkers",
                        hint:
                          checkerTotal != null
                            ? `${checkerTotal} purchases`
                            : "Checker orders",
                        icon: ShieldCheck,
                      },
                      {
                        id: "users" as AdminSection,
                        label: "Users",
                        hint: "Accounts and profiles",
                        icon: Users,
                      },
                      {
                        id: "assistance" as AdminSection,
                        label: "Assistance",
                        hint: "Support requests",
                        icon: HelpCircle,
                      },
                      {
                        id: "emailCampaigns" as AdminSection,
                        label: "Email campaigns",
                        hint: "Reach students",
                        icon: Mail,
                      },
                    ] as const
                  ).map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if ("settingsTab" in item && item.settingsTab) {
                            openSettingsTab(item.settingsTab);
                            return;
                          }
                          selectSection(item.id as AdminSection);
                        }}
                        className="group flex items-center gap-3 rounded-2xl border border-[#E8EEF5] bg-[#F8FBFF] px-3 py-3 text-left transition hover:border-[#93C5FD] hover:bg-white"
                      >
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#007AFF] shadow-sm ring-1 ring-[#DBEAFE]">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[#0F172A]">
                            {item.label}
                          </span>
                          <span className="block truncate text-[11px] text-[#64748B]">
                            {item.hint}
                          </span>
                        </span>
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#94A3B8] transition group-hover:text-[#007AFF]" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="grid gap-3 md:grid-cols-3">
              <button
                type="button"
                onClick={() => selectSection("forms")}
                className="rounded-[1.35rem] border border-[#BFDBFE] bg-gradient-to-br from-[#EFF6FF] to-white px-5 py-5 text-left transition hover:border-[#60A5FA]"
              >
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
                  <Package className="h-4 w-4" />
                  Fulfilment queue
                </p>
                <p className="mt-2 text-2xl font-semibold text-[#0F172A]">
                  {formsUnissued ?? "—"}
                </p>
                <p className="mt-1 text-sm text-[#475569]">
                  Paid orders waiting for voucher codes
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#007AFF]">
                  Open Forms
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </button>
              <button
                type="button"
                onClick={() => selectSection("forms")}
                className="rounded-[1.35rem] border border-[#BBF7D0] bg-gradient-to-br from-[#F0FDF4] to-white px-5 py-5 text-left transition hover:border-[#4ADE80]"
              >
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#15803D]">
                  <ShieldCheck className="h-4 w-4" />
                  Issued snapshot
                </p>
                <p className="mt-2 text-2xl font-semibold text-[#166534]">
                  {formsIssued ?? "—"}
                </p>
                <p className="mt-1 text-sm text-[#475569]">
                  Vouchers already sent to buyers
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#15803D]">
                  View issued
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </button>
              <button
                type="button"
                onClick={() => selectSection("checkers")}
                className="rounded-[1.35rem] border border-[#FDE68A] bg-gradient-to-br from-[#FFFBEB] to-white px-5 py-5 text-left transition hover:border-[#F59E0B]"
              >
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#B45309]">
                  <ShieldCheck className="h-4 w-4" />
                  WASSCE checkers
                </p>
                <p className="mt-2 text-2xl font-semibold text-[#92400E]">
                  {checkerTotal ?? "—"}
                </p>
                <p className="mt-1 text-sm text-[#475569]">
                  Checker purchases across the platform
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#B45309]">
                  Open Checkers
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </button>
            </section>
          </>
        ) : activeSection === "forms" ? (
          <AdminFormsSection />
        ) : activeSection === "manageSchools" ? (
          <AdminManageSchoolsSection />
        ) : activeSection === "partnerSchools" ? (
          <AdminPartnerSchoolsSection />
        ) : activeSection === "partnerVouchers" ? (
          <AdminPartnerVouchersSection />
        ) : activeSection === "formRequests" ? (
          <AdminFormRequestsSection />
        ) : activeSection === "users" ? (
          <AdminUsersSection />
        ) : activeSection === "checkers" ? (
          <AdminCheckersSection />
        ) : activeSection === "assistance" ? (
          <AdminAssistanceSection />
        ) : activeSection === "blog" ? (
          <AdminBlogSection />
        ) : activeSection === "explore" ? (
          <AdminExploreSection />
        ) : activeSection === "ads" ? (
          <AdminAdsSection />
        ) : activeSection === "adReports" ? (
          <AdminAdReportsSection />
        ) : activeSection === "emailCampaigns" ? (
          <AdminEmailCampaignsSection />
        ) : activeSection === "settings" ? (
          <AdminSettingsSection
            adminName={adminName || "Admin"}
            adminRole={adminRole}
            activeTab={settingsTab}
            onTabChange={setSettingsTab}
          />
        ) : activeSection === "staff" ? (
          <AdminStaffSection />
        ) : (
          <AdminAnalyticsSection />
        )}

        {notificationsOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
              onClick={() => setNotificationsOpen(false)}
            />
            <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-xl [padding-bottom:env(safe-area-inset-bottom)]">
              <div className="flex items-center justify-between border-b border-[#E5E5E5] px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:py-4">
                <div>
                  <h2 className="text-base font-semibold text-[#1E1E1E]">
                    Admin notifications
                  </h2>
                  <p className="text-xs text-[#9E9E9E]">
                    Tap an item to open the related admin section.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E0E0E0] text-[#1E1E1E] hover:bg-[#F5F5F5]"
                  aria-label="Close notifications"
                >
                  ×
                </button>
              </div>

              <NotificationInbox
                items={adminNotifications}
                emptyTitle="No admin notifications yet"
                emptyBody="New form voucher and WASSCE checker activity will appear here."
                onOpen={openAdminNotification}
                onToggleRead={(id) =>
                  updateAdminNotifications((current) =>
                    current.map((n) =>
                      n.id === id ? { ...n, read: !n.read } : n,
                    ),
                  )
                }
                onDelete={(id) =>
                  updateAdminNotifications((current) =>
                    current.filter((n) => n.id !== id),
                  )
                }
                onMarkAllRead={() =>
                  updateAdminNotifications((current) =>
                    current.map((n) => ({ ...n, read: true })),
                  )
                }
                onMarkAllUnread={() =>
                  updateAdminNotifications((current) =>
                    current.map((n) => ({ ...n, read: false })),
                  )
                }
                onClearAll={() => {
                  if (adminNotifications.length === 0) return;
                  if (!window.confirm("Clear all admin notifications?")) return;
                  updateAdminNotifications(() => []);
                }}
              />

              <div className="border-t border-[#E5E5E5] px-4 py-2.5 text-xs text-[#9E9E9E] sm:px-5 sm:py-3">
                Manage what you receive from
                <span className="font-medium text-[#1E1E1E]"> Admin notifications</span>
                <span> • TertiaryGuide</span>
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </main>
  );
}
