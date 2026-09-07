"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { UserInitialsAvatar } from "../components/UserInitialsAvatar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    // Paystack return may land on My Forms before email is written to localStorage.
    // Let that page verify first instead of bouncing to sign-in.
    const params = new URLSearchParams(window.location.search);
    if (params.get("reference")?.trim()) return;

    const email = window.localStorage.getItem("tg_user_email");
    if (!email?.trim()) {
      const next = `${pathname || "/dashboard/personal-info"}${window.location.search || ""}`;
      router.replace(`/signin?redirect=${encodeURIComponent(next)}`);
    }
  }, [pathname, router]);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const cached = window.localStorage.getItem("tg_user_name");
      if (cached) setUserName(cached);

      if (cached) setIsLoaded(true);
    }

    const updateFromCache = () => {
      if (typeof window !== "undefined") {
        const cachedName = window.localStorage.getItem("tg_user_name");
        if (cachedName) setUserName(cachedName);
      }
    };

    window.addEventListener("tg-profile-updated", updateFromCache);
    window.addEventListener("tg_user_name_updated", updateFromCache);

    const fetchProfile = async () => {
      try {
        if (typeof window === "undefined") return;
        const email = window.localStorage.getItem("tg_user_email");
        if (!email) return;

        const res = await fetch(`/api/user/me?email=${encodeURIComponent(email)}`);

        let data;
        if (res.ok) {
          data = await res.json();
        } else {
          const resBackup = await fetch(
            `/api/user/profile?email=${encodeURIComponent(email)}`,
          );
          if (resBackup.ok) data = await resBackup.json();
        }

        if (data?.user) {
          const nameToDisplay = data.user.username || data.user.fullName || "";
          if (nameToDisplay) {
            setUserName(nameToDisplay);
            window.localStorage.setItem("tg_user_name", nameToDisplay);
          }
          setIsLoaded(true);
        }
      } catch (error) {
        console.error("Failed to load profile", error);
      }
    };
    fetchProfile();

    return () => {
      window.removeEventListener("tg-profile-updated", updateFromCache);
      window.removeEventListener("tg_user_name_updated", updateFromCache);
    };
  }, []);

  type NavItem =
    | { label: string; href: string; danger?: boolean }
    | { label: string; logout: true; danger?: boolean };

  const navItems: NavItem[] = [
    { label: "Profile", href: "/dashboard/personal-info" },
    { label: "My Forms", href: "/dashboard/my-forms" },
    { label: "My Applications", href: "/dashboard/my-applications" },
    { label: "Assistance", href: "/dashboard/assistance" },
    { label: "Notifications", href: "/dashboard/notification" },
    { label: "Password", href: "/dashboard/password" },
    { label: "Logout", logout: true, danger: true },
  ];

  function tabClass(active: boolean, danger?: boolean) {
    if (danger) {
      return active
        ? "bg-red-50 text-[#E33F3F] ring-1 ring-red-200"
        : "bg-white text-[#E33F3F] ring-1 ring-red-100 hover:bg-red-50";
    }
    return active
      ? "bg-[#007AFF] text-white shadow-sm shadow-[#007AFF]/20"
      : "bg-white text-[#555555] ring-1 ring-gray-200 hover:bg-gray-50 hover:text-[#007AFF]";
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#1E1E1E]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pb-8 sm:px-6 md:gap-5 md:px-10 md:pb-10">
        <Header showUserControls />

        <main className="flex flex-col gap-6 md:gap-8">
          {/* Profile */}
          <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm sm:px-5">
            {!isLoaded && !userName ? (
              <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-gray-200 sm:h-14 sm:w-14" />
            ) : (
              <UserInitialsAvatar name={userName} size="lg" className="ring-white" />
            )}
            {!isLoaded && !userName ? (
              <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
            ) : (
              <div className="min-w-0">
                <p className="truncate text-xl font-semibold sm:text-2xl">
                  {userName || "User"}
                </p>
                <p className="text-xs text-gray-500 sm:text-sm">
                  Student portal
                </p>
              </div>
            )}
          </div>

          {/* Horizontal nav */}
          <nav
            className="rounded-2xl border border-gray-100 bg-white p-2 shadow-sm"
            aria-label="Dashboard navigation"
          >
            <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {navItems.map((item, index) => {
                const active =
                  "href" in item ? pathname === item.href : false;
                const showDivider =
                  item.danger &&
                  index > 0 &&
                  !("danger" in navItems[index - 1] && navItems[index - 1].danger);

                if ("logout" in item && item.logout) {
                  return (
                    <React.Fragment key={item.label}>
                      {showDivider && (
                        <div
                          className="mx-0.5 w-px shrink-0 self-stretch bg-gray-200"
                          aria-hidden
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setLogoutOpen(true)}
                        className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition active:scale-[0.98] ${tabClass(false, true)}`}
                      >
                        {item.label}
                      </button>
                    </React.Fragment>
                  );
                }

                if ("href" in item) {
                  return (
                    <React.Fragment key={item.href}>
                      {showDivider && (
                        <div
                          className="mx-0.5 w-px shrink-0 self-stretch bg-gray-200"
                          aria-hidden
                        />
                      )}
                      <Link
                        href={item.href}
                        className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition active:scale-[0.98] ${tabClass(active, item.danger)}`}
                      >
                        {item.label}
                      </Link>
                    </React.Fragment>
                  );
                }

                return null;
              })}
            </div>
          </nav>

          <section
            className={
              pathname === "/dashboard/my-forms" ||
              pathname === "/dashboard/my-applications"
                ? "min-w-0 flex-1"
                : "min-w-0 flex-1 space-y-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6 md:p-8"
            }
          >
            {children}
          </section>
        </main>
      </div>

      {logoutOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-lg">
            <p className="mb-4 text-lg font-semibold text-[#1E1E1E]">
              Are you sure you want to log out?
            </p>
            <p className="mb-6 text-sm text-[#555555]">
              You will need to sign in again to access your dashboard.
            </p>

            <div className="flex flex-col items-center gap-3 md:flex-row md:justify-center">
              <button
                type="button"
                className="rounded-full border border-[#1E1E1E] bg-white px-6 py-2.5 text-sm font-medium text-[#1E1E1E] transition hover:bg-[#F5F5F5]"
                onClick={() => setLogoutOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-[#E33F3F] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-[#C42C2C]"
                onClick={() => {
                  setLogoutOpen(false);
                  try {
                    if (typeof window !== "undefined") {
                      window.localStorage.removeItem("tg_user_email");
                    }
                  } catch {
                    // ignore storage errors on logout
                  }
                  router.push("/");
                }}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}
