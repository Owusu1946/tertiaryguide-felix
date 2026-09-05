"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  BookOpen,
  Building2,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  FileStack,
  GraduationCap,
  Home,
  Info,
  LifeBuoy,
  LogOut,
  Menu,
  Search,
  User,
  X,
} from "lucide-react";
import {
  getCheckerPillVisibility,
  getVoucherPillVisibility,
  mergeCheckerAfterPollFulfilled,
  mergeCheckerHeaderDismiss,
  mergeVoucherAfterPollFulfilled,
  mergeVoucherHeaderDismiss,
  type LastCheckerStored,
  type LastVoucherStored,
} from "@/lib/last-purchase-badges";
import { NotificationInbox } from "@/app/components/NotificationInbox";
import {
  readUserNotifications,
  resolveNotificationHref,
  unreadCount,
  userNotificationsKey,
  type AppNotification,
} from "@/lib/notifications";

type NavServiceItem = {
  name: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: (pathname: string) => boolean;
};

type NavServiceGroup = {
  label: string;
  items: NavServiceItem[];
};
function readLastPurchasesFromStorage(): {
  voucher: LastVoucherStored | null;
  checker: LastCheckerStored | null;
} {
  if (typeof window === "undefined") {
    return { voucher: null, checker: null };
  }
  let voucher: LastVoucherStored | null = null;
  let checker: LastCheckerStored | null = null;
  try {
    const rawVoucher = window.localStorage.getItem("tg_last_voucher_purchase");
    if (rawVoucher) {
      const p = JSON.parse(rawVoucher) as LastVoucherStored;
      if (p && typeof p === "object" && typeof p.reference === "string") {
        voucher = {
          ...p,
          email: typeof p.email === "string" ? p.email : "",
          schoolId: typeof p.schoolId === "string" ? p.schoolId : null,
          reference: p.reference,
          pending: Boolean(p.pending),
        };
      }
    }
    const rawChecker = window.localStorage.getItem("tg_last_checker_purchase");
    if (rawChecker) {
      const p = JSON.parse(rawChecker) as LastCheckerStored;
      if (p && typeof p === "object" && typeof p.reference === "string") {
        checker = {
          ...p,
          email: typeof p.email === "string" ? p.email : "",
          reference: p.reference,
          pending: Boolean(p.pending),
        };
      }
    }
  } catch {
    voucher = null;
    checker = null;
  }
  return { voucher, checker };
}

function TertiaryLogo() {
  return (
    <Link href="/" className="inline-flex bg-transparent">
      <Image
        src="/hero/logoTguide.png"
        alt="TertiaryGuide"
        width={1029}
        height={163}
        priority
        quality={100}
        sizes="(max-width: 768px) 172px, 216px"
        className="h-8 w-auto bg-transparent object-contain cursor-pointer md:h-10"
      />
    </Link>
  );
}


export function Header({ hideAuth, showUserControls }: { hideAuth?: boolean; showUserControls?: boolean } = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [exploreTabActive, setExploreTabActive] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [hasNewsNotification, setHasNewsNotification] = useState(false);
  const [userNotifications, setUserNotifications] = useState<AppNotification[]>(
    [],
  );
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const [lastVoucher, setLastVoucher] = useState<LastVoucherStored | null>(null);
  const [lastChecker, setLastChecker] = useState<LastCheckerStored | null>(null);
  const [avatar, setAvatar] = useState("/hero/avatar.png");
  const [isLoaded, setIsLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(64);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const updateHeight = () => {
      setHeaderHeight(header.offsetHeight);
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(header);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const updateAvatar = () => {
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem("tg_user_avatar");
        if (stored) {
          setAvatar(stored);
          setIsLoaded(true);
        }
      }
    };
    updateAvatar();
    window.addEventListener("tg-profile-updated", updateAvatar);
    return () => window.removeEventListener("tg-profile-updated", updateAvatar);
  }, []);

  useEffect(() => {
    if (!solutionsOpen) return;

    const handleClick = (event: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target as Node)) {
        setSolutionsOpen(false);
      }
    };

    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [solutionsOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const syncExploreTab = () => {
      if (typeof window === "undefined") return;
      const onHome = window.location.pathname === "/";
      const tab = new URLSearchParams(window.location.search).get("tab");
      const onExplorePage = window.location.pathname === "/explore";
      setExploreTabActive(onExplorePage || (onHome && tab === "explore"));
    };

    syncExploreTab();
    window.addEventListener("popstate", syncExploreTab);
    window.addEventListener("tg-home-tab", syncExploreTab);
    return () => {
      window.removeEventListener("popstate", syncExploreTab);
      window.removeEventListener("tg-home-tab", syncExploreTab);
    };
  }, [pathname]);

  useEffect(() => {
    const checkAuth = () => {
      try {
        if (typeof window === "undefined") return;
        const email = window.localStorage.getItem("tg_user_email");
        setIsAuthed(Boolean(email));
      } catch {
        setIsAuthed(false);
      }
    };

    checkAuth();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "tg_user_email") {
        checkAuth();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorage);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorage);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const read = () => {
      const { voucher, checker } = readLastPurchasesFromStorage();
      setLastVoucher(voucher);
      setLastChecker(checker);
    };

    read();

    const handler = () => {
      read();

      // Also check for new notifications based on the voucher status
      try {
        const raw = window.localStorage.getItem("tg_last_voucher_purchase");
        if (!raw) return;

        const parsed = JSON.parse(raw);
        if (!parsed) return;

        const reference = parsed.reference;
        if (!reference) return;

        // Generate a notification ID based on reference and status
        const notifId = `${reference}-${parsed.pending ? "pending" : "issued"}`;

        setUserNotifications((prev) => {
          // Avoid duplicates
          if (prev.some((n) => n.id === notifId)) return prev;

          const newNotification: AppNotification = {
            id: notifId,
            title: parsed.pending ? "Voucher Queued" : "Voucher Issued",
            body: parsed.pending
              ? "Your voucher is in queue. It will be sent shortly."
              : "Your voucher has been successfully issued.",
            read: false,
            createdAt: new Date().toISOString(),
            href: "/dashboard/my-forms",
            kind: "voucher",
          };

          const next = [newNotification, ...prev];

          // Sync to local storage immediately
          if (typeof window !== "undefined") {
            const email = window.localStorage.getItem("tg_user_email");
            if (email) {
              const key = `tg_notifications:${email.toLowerCase()}`;
              window.localStorage.setItem(key, JSON.stringify(next));
              window.dispatchEvent(new CustomEvent("tg-notifications-updated"));
            }
          }

          return next;
        });

      } catch (e) {
        console.error("Error processing voucher notification", e);
      }
    };

    const checkerHandler = () => {
      read();
      try {
        const raw = window.localStorage.getItem("tg_last_checker_purchase");
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.reference) return;

        const notifId = `checker-${parsed.reference}-${parsed.pending ? "pending" : "issued"}`;

        setUserNotifications((prev) => {
          if (prev.some((n) => n.id === notifId)) return prev;

          const newNotification: AppNotification = {
            id: notifId,
            title: parsed.pending ? "WASSCE Order Queued" : "WASSCE Checker Issued",
            body: parsed.pending
              ? "Your order is in queue. It will be sent shortly."
              : "Your WASSCE checker has been successfully issued.",
            read: false,
            createdAt: new Date().toISOString(),
            href: "/dashboard/my-checkers",
            kind: "checker",
          };

          const next = [newNotification, ...prev];

          if (typeof window !== "undefined") {
            const email = window.localStorage.getItem("tg_user_email");
            if (email) {
              const key = `tg_notifications:${email.toLowerCase()}`;
              window.localStorage.setItem(key, JSON.stringify(next));
              window.dispatchEvent(new CustomEvent("tg-notifications-updated"));
            }
          }
          return next;
        });
      } catch (e) {
        console.error("Error processing checker notification", e);
      }
    };

    window.addEventListener(
      "tg-voucher-purchased",
      handler as unknown as EventListener,
    );
    window.addEventListener(
      "tg-checker-purchased",
      checkerHandler as unknown as EventListener,
    );

    return () => {
      window.removeEventListener(
        "tg-voucher-purchased",
        handler as unknown as EventListener,
      );
      window.removeEventListener(
        "tg-checker-purchased",
        checkerHandler as unknown as EventListener,
      );
    };
  }, []);

  // Poll for pending voucher updates
  useEffect(() => {
    if (!lastVoucher || !lastVoucher.pending || !lastVoucher.reference) return;

    const reference = lastVoucher.reference;
    let isMounted = true;

    const checkStatus = async () => {
      try {
        const res = await fetch(
          `/api/user/orders/status?reference=${encodeURIComponent(reference)}`
        );
        if (!res.ok) return;
        const data = await res.json();

        if (isMounted && data.ok && !data.pending) {
          if (typeof window !== "undefined") {
            const raw = window.localStorage.getItem("tg_last_voucher_purchase");
            if (!raw) return;
            let existing: LastVoucherStored;
            try {
              existing = JSON.parse(raw) as LastVoucherStored;
            } catch {
              return;
            }
            if (existing.reference !== reference) return;
            const merged = mergeVoucherAfterPollFulfilled(existing);
            window.localStorage.setItem(
              "tg_last_voucher_purchase",
              JSON.stringify(merged),
            );
            setLastVoucher(merged);
            window.dispatchEvent(new Event("tg-voucher-purchased"));
            window.dispatchEvent(new Event("tg-purchases-updated"));
            setNotificationsOpen(true);
          }
        }
      } catch (e) {
        console.error("Error checking voucher status", e);
      }
    };

    // Poll every 10 seconds
    const interval = setInterval(checkStatus, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastVoucher?.pending, lastVoucher?.reference]);

  // Poll for pending checker updates
  useEffect(() => {
    if (!lastChecker || !lastChecker.pending || !lastChecker.reference) return;
    const reference = lastChecker.reference;
    let isMounted = true;

    const checkStatus = async () => {
      try {
        const res = await fetch(
          `/api/user/orders/status?reference=${encodeURIComponent(reference)}`
        );
        if (!res.ok) return;
        const data = await res.json();

        if (isMounted && data.ok && !data.pending) {
          if (typeof window !== "undefined") {
            const raw = window.localStorage.getItem("tg_last_checker_purchase");
            if (!raw) return;
            let existing: LastCheckerStored;
            try {
              existing = JSON.parse(raw) as LastCheckerStored;
            } catch {
              return;
            }
            if (existing.reference !== reference) return;
            const merged = mergeCheckerAfterPollFulfilled(existing);
            window.localStorage.setItem(
              "tg_last_checker_purchase",
              JSON.stringify(merged),
            );
            setLastChecker(merged);
            window.dispatchEvent(new Event("tg-checker-purchased"));
            window.dispatchEvent(new Event("tg-purchases-updated"));
            setNotificationsOpen(true);
          }
        }
      } catch (e) {
        console.error("Error checking checker status", e);
      }
    };

    // Poll every 10 seconds
    const interval = setInterval(checkStatus, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastChecker?.pending, lastChecker?.reference]);

  // Load saved notifications so the bell and drawer stay in sync.
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        if (typeof window === "undefined") return;
        const email = window.localStorage.getItem("tg_user_email");
        if (!email) {
          setHasNewsNotification(false);
          setUserNotifications([]);
          return;
        }

        const items = readUserNotifications(email);
        setUserNotifications(items);

        try {
          const res = await fetch(
            `/api/notification/preferences?email=${encodeURIComponent(email)}`,
          );
          const data = await res.json();
          setHasNewsNotification(Boolean(res.ok && data.newsUpdates));
        } catch {
          setHasNewsNotification(false);
        }
      } catch {
        setHasNewsNotification(false);
        setUserNotifications([]);
      }
    };

    if (!isAuthed) {
      setHasNewsNotification(false);
      setUserNotifications([]);
      return;
    }

    void loadNotifications();

    const handleUpdated = () => {
      void loadNotifications();
    };

    const handleStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (event.key.startsWith("tg_notifications:")) {
        void loadNotifications();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener(
        "tg-notifications-updated",
        handleUpdated as EventListener,
      );
      window.addEventListener("storage", handleStorage as EventListener);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(
          "tg-notifications-updated",
          handleUpdated as EventListener,
        );
        window.removeEventListener("storage", handleStorage as EventListener);
      }
    };
  }, [isAuthed]);

  const persistNotifications = (
    updater: (current: AppNotification[]) => AppNotification[],
  ) => {
    if (typeof window === "undefined") return;
    const email = window.localStorage.getItem("tg_user_email");
    if (!email) return;

    setUserNotifications((current) => {
      const next = updater(current);
      try {
        window.localStorage.setItem(
          userNotificationsKey(email),
          JSON.stringify(next.slice(0, 80)),
        );
      } catch {
        // ignore quota errors
      }
      return next;
    });
    queueMicrotask(() => {
      window.dispatchEvent(new CustomEvent("tg-notifications-updated"));
    });
  };

  const notificationCount = unreadCount(userNotifications);

  const openNotification = (notification: AppNotification) => {
    persistNotifications((current) =>
      current.map((n) =>
        n.id === notification.id ? { ...n, read: true } : n,
      ),
    );
    setNotificationsOpen(false);
    router.push(resolveNotificationHref(notification));
  };

  const myFormsHref = isAuthed
    ? "/dashboard/my-forms"
    : `/signin?redirect=${encodeURIComponent("/dashboard/my-forms")}`;

  const assistanceHref = isAuthed
    ? "/dashboard/assistance"
    : `/signin?redirect=${encodeURIComponent("/dashboard/assistance")}`;

  const assistanceLinkActive = pathname === "/dashboard/assistance";

  const serviceGroups: NavServiceGroup[] = [
    {
      label: "Services",
      items: [
        {
          name: "WASSCE Checker",
          description: "Purchase a PIN to check your results",
          href: "/wassce-checker",
          icon: ClipboardCheck,
          match: (path) =>
            path === "/wassce-checker" ||
            path.startsWith("/wassce-checker/"),
        },
        {
          name: "All Forms",
          description: "Buy application forms for universities and colleges",
          href: "/university-forms",
          icon: Building2,
          match: (path) =>
            path === "/university-forms" ||
            path.startsWith("/university-forms/"),
        },
        {
          name: "My Forms",
          description: "View forms and vouchers you have purchased",
          href: myFormsHref,
          icon: FileStack,
          match: (path) => path === "/dashboard/my-forms",
        },
        {
          name: "Programme Search",
          description: "Find and compare programmes across schools",
          href: "/program-search",
          icon: Search,
          match: (path) =>
            path === "/program-search" ||
            path.startsWith("/program-search/"),
        },
      ],
    },
    {
      label: "Apply",
      items: [
        {
          name: "Apply online",
          description: "Apply online through the TertiaryGuide portal",
          href: "/apply",
          icon: GraduationCap,
          match: (path) =>
            path === "/apply" ||
            path.startsWith("/apply/school/") ||
            path.startsWith("/apply/portal"),
        },
      ],
    },
  ];

  const allServiceItems = serviceGroups.flatMap((group) => group.items);
  const servicesActive = allServiceItems.some((item) =>
    item.match ? item.match(pathname) : pathname === item.href.split("?")[0],
  );

  function isMobileNavActive(href: string, itemName?: string): boolean {
    if (itemName === "Get assistance") return assistanceLinkActive;
    const service = allServiceItems.find((item) => item.name === itemName);
    if (service?.match) return service.match(pathname);
    if (itemName === "My Forms") {
      return pathname === "/dashboard/my-forms";
    }
    const path = href.split("?")[0];
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(`${path}/`);
  }

  const mobileNavSections: {
    label: string | null;
    items: {
      name: string;
      href: string;
      icon: React.ComponentType<{ className?: string }>;
    }[];
  }[] = [
    {
      label: null,
      items: [{ name: "Home", href: "/", icon: Home }],
    },
    {
      label: "Services",
      items: [
        ...allServiceItems.map((item) => ({
          name: item.name,
          href: item.href,
          icon: item.icon,
        })),
        ...(hideAuth
          ? []
          : [
              {
                name: "Get assistance",
                href: assistanceHref,
                icon: LifeBuoy,
              },
            ]),
      ],
    },
    {
      label: "Explore",
      items: [
        { name: "About", href: "/about", icon: Info },
        { name: "Blog", href: "/blog", icon: BookOpen },
        { name: "FAQs", href: "/faqs", icon: CircleHelp },
      ],
    },
  ];
  const voucherPill = getVoucherPillVisibility(lastVoucher);
  const checkerPill = getCheckerPillVisibility(lastChecker);

  const dismissVoucherPill = () => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("tg_last_voucher_purchase");
      if (raw) {
        const existing = JSON.parse(raw) as LastVoucherStored;
        const merged = mergeVoucherHeaderDismiss(existing);
        window.localStorage.setItem(
          "tg_last_voucher_purchase",
          JSON.stringify(merged),
        );
        setLastVoucher(merged);
        window.dispatchEvent(new Event("tg-purchases-updated"));
      }
    } catch {
      // ignore
    }
  };

  const dismissCheckerPill = () => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("tg_last_checker_purchase");
      if (raw) {
        const existing = JSON.parse(raw) as LastCheckerStored;
        const merged = mergeCheckerHeaderDismiss(existing);
        window.localStorage.setItem(
          "tg_last_checker_purchase",
          JSON.stringify(merged),
        );
        setLastChecker(merged);
        window.dispatchEvent(new Event("tg-purchases-updated"));
      }
    } catch {
      // ignore
    }
  };

  const notificationsPanel = (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-[1px]"
        onClick={() => setNotificationsOpen(false)}
      />
      <div className="fixed inset-y-0 right-0 z-[110] flex w-full max-w-sm flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#E5E5E5] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[#1E1E1E]">
              Notifications
            </h2>
            <p className="text-xs text-[#9E9E9E]">
              Tap an item to open the related page.
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
          items={userNotifications}
          onOpen={(item) => openNotification(item as AppNotification)}
          onToggleRead={(id) =>
            persistNotifications((current) =>
              current.map((n) => (n.id === id ? { ...n, read: !n.read } : n)),
            )
          }
          onDelete={(id) =>
            persistNotifications((current) => current.filter((n) => n.id !== id))
          }
          onMarkAllRead={() =>
            persistNotifications((current) =>
              current.map((n) => ({ ...n, read: true })),
            )
          }
          onMarkAllUnread={() =>
            persistNotifications((current) =>
              current.map((n) => ({ ...n, read: false })),
            )
          }
          onClearAll={() => {
            if (userNotifications.length === 0) return;
            if (
              typeof window !== "undefined" &&
              !window.confirm("Clear all notifications?")
            ) {
              return;
            }
            persistNotifications(() => []);
          }}
        />

        <div className="border-t border-[#E5E5E5] px-5 py-3 text-xs text-[#9E9E9E]">
          {hasNewsNotification ? (
            <p className="mb-1">News and product updates are on.</p>
          ) : null}
          <Link
            href="/dashboard/notification"
            onClick={() => setNotificationsOpen(false)}
            className="font-medium text-[#007AFF] hover:underline"
          >
            See all & manage preferences
          </Link>
        </div>
      </div>
    </>
  );

  return (
    <>
    <header
      ref={headerRef}
      className="fixed top-0 left-0 right-0 z-40 w-full"
    >
      <div
        className={`border-b bg-white/95 backdrop-blur-md transition-[box-shadow,border-color] duration-200 supports-[backdrop-filter]:bg-white/85 ${
          scrolled
            ? "border-[#E8E8E8] shadow-[0_4px_20px_rgba(15,23,42,0.06)]"
            : "border-transparent"
        }`}
      >
        <div className="mx-auto flex min-w-0 max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6 md:px-10">
      {/* Logo */}
      <div className="min-w-0 flex shrink-0 items-center gap-3">
        <TertiaryLogo />
      </div>

      {/* Center nav (desktop only) */}
      <nav className="relative hidden items-center gap-8 text-sm font-medium text-[#1E1E1E] lg:gap-10 md:flex">
        <Link
          href="/"
          className={
            pathname === "/" && !exploreTabActive
              ? "text-[#007AFF]"
              : "hover:text-[#007AFF]"
          }
        >
          Home
        </Link>
        <Link
          href="/explore"
          className={
            pathname === "/explore" || exploreTabActive
              ? "text-[#007AFF]"
              : "hover:text-[#007AFF]"
          }
        >
          Explore
        </Link>
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setSolutionsOpen((prev) => !prev)}
            aria-expanded={solutionsOpen}
            aria-haspopup="menu"
            className={`flex items-center gap-1 transition ${
              solutionsOpen || servicesActive
                ? "text-[#007AFF]"
                : "hover:text-[#007AFF]"
            }`}
          >
            <span>Services</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                solutionsOpen ? "rotate-180" : "rotate-0"
              }`}
            />
          </button>

          {solutionsOpen && (
            <div
              role="menu"
              className="absolute left-1/2 top-full z-30 mt-3 hidden w-[min(36rem,calc(100vw-3rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-[#E8EEF5] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.12)] md:block lg:left-0 lg:translate-x-0"
            >
              <div className="border-b border-[#F0F4F8] bg-[#FAFCFF] px-5 py-3.5">
                <p className="text-sm font-semibold text-[#1E1E1E]">
                  Everything you need for admissions
                </p>
                <p className="mt-0.5 text-xs text-[#6B7280]">
                  Forms, applications, programme search, and result checkers
                </p>
              </div>

              <div className="grid gap-5 p-4 sm:grid-cols-2 sm:gap-6 sm:p-5">
                {serviceGroups.map((group) => (
                  <div key={group.label} className="min-w-0 space-y-2">
                    <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                      {group.label}
                    </p>
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active = item.match
                          ? item.match(pathname)
                          : pathname === item.href.split("?")[0];

                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            role="menuitem"
                            onClick={() => setSolutionsOpen(false)}
                            className={`flex items-start gap-3 rounded-xl px-2.5 py-2.5 transition ${
                              active
                                ? "bg-[#EFF6FF] ring-1 ring-[#007AFF]/15"
                                : "hover:bg-[#F8FAFC]"
                            }`}
                          >
                            <span
                              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                active
                                  ? "bg-[#007AFF] text-white"
                                  : "bg-[#EFF6FF] text-[#007AFF]"
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 pt-0.5">
                              <span
                                className={`block text-sm font-semibold leading-snug ${
                                  active ? "text-[#007AFF]" : "text-[#1E1E1E]"
                                }`}
                              >
                                {item.name}
                              </span>
                              <span className="mt-0.5 block text-xs leading-relaxed text-[#6B7280]">
                                {item.description}
                              </span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Link
          href="/about"
          className={
            pathname === "/about"
              ? "text-[#007AFF]"
              : "hover:text-[#007AFF]"
          }
        >
          About
        </Link>
        <Link
          href="/blog"
          className={
            pathname === "/blog" || pathname.startsWith("/blog/")
              ? "text-[#007AFF]"
              : "hover:text-[#007AFF]"
          }
        >
          Blog
        </Link>
        <Link
          href="/faqs"
          className={
            pathname === "/faqs"
              ? "text-[#007AFF]"
              : "hover:text-[#007AFF]"
          }
        >
          FAQs
        </Link>
      </nav>
      {/* Right controls */}
      <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2 md:gap-4">
      {/* Right controls (desktop only) — guest */}
      {!hideAuth && !showUserControls && !isAuthed && (
        <div className="hidden items-center gap-4 md:flex">
          {voucherPill.show &&
            lastVoucher?.reference &&
            !pathname.includes(lastVoucher.reference) && (
            <Link
              href={
                lastVoucher?.reference
                  ? "/dashboard/my-forms"
                  : "/university-forms"
              }
              onClick={dismissVoucherPill}
              className="inline-flex items-center gap-1 rounded-full border border-[#E5E7EB] px-3 py-1 text-[11px] font-medium text-[#111827] hover:bg-[#F3F4F6]"
            >
              <span>
                {voucherPill.label === "pending"
                  ? "Voucher pending"
                  : "Voucher ready"}
              </span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}

          {checkerPill.show &&
            lastChecker?.reference &&
            !pathname.includes(lastChecker.reference) && (
            <Link
              href={
                lastChecker.reference
                  ? `/wassce-checker/success?reference=${encodeURIComponent(
                    lastChecker.reference,
                  )}&fromHeader=1`
                  : "/wassce-checker"
              }
              onClick={dismissCheckerPill}
              className="inline-flex items-center gap-1 rounded-full border border-[#E5E7EB] px-3 py-1 text-[11px] font-medium text-[#111827] hover:bg-[#F3F4F6]"
            >
              <span>
                {checkerPill.label === "pending"
                  ? "Checker pending"
                  : "Checker ready"}
              </span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}

          <Link
            href={assistanceHref}
            className={`text-sm font-semibold transition ${
              assistanceLinkActive
                ? "text-[#007AFF] underline decoration-[#007AFF]/40 underline-offset-4"
                : "text-[#007AFF] hover:text-[#0062CC]"
            }`}
          >
            Get assistance
          </Link>

          <Link
            href="/signin"
            className="text-sm font-medium text-[#1E1E1E] hover:text-[#007AFF]"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="flex items-center gap-2 rounded-xl bg-[#007AFF] px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#0062CC]"
          >
            <span>Sign Up</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {(showUserControls || isAuthed) && (
        <div className="hidden items-center gap-4 md:flex">
          {voucherPill.show &&
            lastVoucher?.reference &&
            !pathname.includes(lastVoucher.reference) && (
            <Link
              href={
                lastVoucher?.reference
                  ? "/dashboard/my-forms"
                  : "/university-forms"
              }
              onClick={dismissVoucherPill}
              className="inline-flex items-center gap-1 rounded-full border border-[#E5E7EB] px-3 py-1 text-[11px] font-medium text-[#111827] hover:bg-[#F3F4F6]"
            >
              <span>
                {voucherPill.label === "pending"
                  ? "Voucher pending"
                  : "Voucher ready"}
              </span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}

          {checkerPill.show &&
            lastChecker?.reference &&
            !pathname.includes(lastChecker.reference) && (
            <Link
              href={
                lastChecker.reference
                  ? `/wassce-checker/success?reference=${encodeURIComponent(
                    lastChecker.reference,
                  )}&fromHeader=1`
                  : "/wassce-checker"
              }
              onClick={dismissCheckerPill}
              className="inline-flex items-center gap-1 rounded-full border border-[#E5E7EB] px-3 py-1 text-[11px] font-medium text-[#111827] hover:bg-[#F3F4F6]"
            >
              <span>
                {checkerPill.label === "pending"
                  ? "Checker pending"
                  : "Checker ready"}
              </span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}

          <Link
            href={assistanceHref}
            className={`text-sm font-semibold transition ${
              assistanceLinkActive
                ? "text-[#007AFF] underline decoration-[#007AFF]/40 underline-offset-4"
                : "text-[#007AFF] hover:text-[#0062CC]"
            }`}
          >
            Get assistance
          </Link>

          <div className="relative">
            <button
              type="button"
              onClick={() => setNotificationsOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E0E0E0] text-[#1E1E1E] hover:border-[#D0D0D0] hover:bg-[#F5F5F5]"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </button>
            {notificationCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#007AFF] px-1 text-[10px] font-semibold text-white shadow-sm">
                {notificationCount}
              </span>
            )}
          </div>
          <Link href="/dashboard/personal-info" aria-label="Open personal info">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {!isLoaded && avatar === "/woman.png" ? (
              <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
            ) : (
              <Image
                src={avatar}
                alt="Profile"
                width={40}
                height={40}
                className="h-10 w-10 rounded-full object-cover"
              />
            )}
          </Link>
        </div>
      )}

        {/* Mobile: notifications + menu */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 md:hidden">
          {!hideAuth && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E0E0E0] text-[#1E1E1E] transition hover:border-[#D0D0D0] hover:bg-[#F5F5F5] active:scale-[0.95]"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
              </button>
              {notificationCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#007AFF] px-0.5 text-[9px] font-semibold text-white shadow-sm">
                  {notificationCount}
                </span>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E0E0E0] text-[#1E1E1E] transition hover:border-[#D0D0D0] hover:bg-[#F5F5F5] active:scale-[0.95]"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
        </div>
      </div>
    </header>

    <div
      aria-hidden
      className="w-full shrink-0"
      style={{ height: headerHeight }}
    />

    {mounted &&
      notificationsOpen &&
      createPortal(notificationsPanel, document.body)}

    {mounted &&
      mobileMenuOpen &&
      createPortal(
        <>
          <div
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[1px] transition-opacity duration-300 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden
          />

          <div
            className={`fixed inset-y-0 right-0 z-[110] flex w-[min(100vw,20rem)] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out md:hidden ${
              mobileMenuOpen ? "translate-x-0" : "translate-x-full"
            }`}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <p className="text-base font-semibold text-[#1E1E1E]">Menu</p>
                <p className="text-xs text-gray-500">Navigate TertiaryGuide</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:bg-gray-50 active:scale-95"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable nav */}
            <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-4">
              {mobileNavSections.map((section) => (
                <div
                  key={section.label ?? "main"}
                  className={section.label ? "mt-6 first:mt-0" : ""}
                >
                  {section.label && (
                    <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      {section.label}
                    </p>
                  )}

                  <div
                    className={
                      section.label === "Services"
                        ? "space-y-0.5 rounded-2xl bg-gray-50/90 p-1.5 ring-1 ring-gray-100"
                        : "space-y-0.5"
                    }
                  >
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active = isMobileNavActive(item.href, item.name);

                      return (
                        <Link
                          key={`${item.name}-${item.href}`}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition active:scale-[0.98] ${
                            active
                              ? "bg-[#007AFF]/10 text-[#007AFF] ring-1 ring-[#007AFF]/15"
                              : "text-gray-700 hover:bg-white hover:text-[#007AFF]"
                          }`}
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                              active
                                ? "bg-[#007AFF]/15 text-[#007AFF]"
                                : "bg-white text-gray-500 ring-1 ring-gray-100"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1 leading-snug">
                            {item.name}
                          </span>
                          {active && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#007AFF]" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {/* Account footer */}
            {!hideAuth && (
              <div className="shrink-0 border-t border-gray-100 bg-gray-50/60 px-4 py-4">
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Account
                </p>

                {isAuthed ? (
                  <div className="space-y-2">
                    <Link
                      href="/dashboard/personal-info"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-[15px] font-medium text-gray-700 ring-1 ring-gray-100 transition hover:text-[#007AFF] active:scale-[0.98]"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
                        <User className="h-4 w-4" />
                      </span>
                      Profile
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.removeItem("tg_user_email");
                        localStorage.removeItem("tg_user_avatar");
                        setIsAuthed(false);
                        setMobileMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-medium text-red-600 transition hover:bg-red-50 active:scale-[0.98]"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500">
                        <LogOut className="h-4 w-4" />
                      </span>
                      Sign out
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="/signin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-[#1E1E1E] transition hover:border-[#007AFF]/30 hover:text-[#007AFF] active:scale-[0.98]"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/signup"
                      onClick={() => setMobileMenuOpen(false)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0062CC] active:scale-[0.98]"
                    >
                      Sign Up
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
