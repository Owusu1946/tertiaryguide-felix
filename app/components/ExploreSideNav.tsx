"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ClipboardCheck,
  Compass,
  FileStack,
  GraduationCap,
  Home,
  Search,
  User,
} from "lucide-react";
import {
  getStoredUserEmail,
  getStoredUserName,
  signInRedirectHref,
} from "@/lib/client-auth";

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (pathname: string) => boolean;
};

const TOP_ITEMS: NavItem[] = [
  { name: "Home", href: "/", icon: Home, match: (p) => p === "/" },
  {
    name: "Explore",
    href: "/explore",
    icon: Compass,
    match: (p) => p === "/explore",
  },
];

const SERVICE_ITEMS: NavItem[] = [
  {
    name: "WASSCE Checker",
    href: "/wassce-checker",
    icon: ClipboardCheck,
    match: (p) => p === "/wassce-checker" || p.startsWith("/wassce-checker/"),
  },
  {
    name: "All Forms",
    href: "/university-forms",
    icon: Building2,
    match: (p) => p === "/university-forms" || p.startsWith("/university-forms/"),
  },
  {
    name: "Programme Search",
    href: "/program-search",
    icon: Search,
    match: (p) => p === "/program-search" || p.startsWith("/program-search/"),
  },
  {
    name: "Apply online",
    href: "/apply",
    icon: GraduationCap,
    match: (p) =>
      p === "/apply" || p.startsWith("/apply/school/") || p.startsWith("/apply/portal"),
  },
];

function navClass(active: boolean) {
  return `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
    active
      ? "bg-[#EFF6FF] font-semibold text-[#007AFF]"
      : "font-medium text-[#1E1E1E] hover:bg-[#F8FAFC] hover:text-[#007AFF]"
  }`;
}

function NavLink({
  item,
  active,
}: {
  item: NavItem;
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={item.name}
      className={navClass(active)}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="hidden lg:inline">{item.name}</span>
    </Link>
  );
}

export function ExploreSideNav() {
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    const email = getStoredUserEmail();
    setAuthed(Boolean(email));
    setDisplayName(getStoredUserName() || email?.split("@")[0] || "");
  }, []);

  const myFormsHref = authed
    ? "/dashboard/my-forms"
    : signInRedirectHref("/dashboard/my-forms");
  const accountHref = authed ? "/dashboard/personal-info" : "/signin";

  const navItems: NavItem[] = [
    ...TOP_ITEMS,
    SERVICE_ITEMS[0], // WASSCE Checker
    SERVICE_ITEMS[1], // All Forms
    {
      name: "My Forms",
      href: myFormsHref,
      icon: FileStack,
      match: (p) => p === "/dashboard/my-forms",
    },
    SERVICE_ITEMS[2], // Programme Search
    SERVICE_ITEMS[3], // Apply online
  ];

  return (
    <aside className="sticky top-16 z-20 hidden h-[calc(100dvh-4rem)] w-[72px] shrink-0 flex-col justify-between overflow-y-auto px-2 py-3 md:flex lg:w-[220px] xl:w-[240px]">
      <nav className="flex flex-col gap-0.5" aria-label="Explore">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            item={item}
            active={item.match(pathname)}
          />
        ))}

        <Link
          href="/apply"
          className="mt-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#007AFF] text-white shadow-sm transition hover:bg-[#0062CC] lg:h-auto lg:w-full lg:px-5 lg:py-2.5"
        >
          <GraduationCap className="h-4 w-4 lg:hidden" />
          <span className="hidden text-sm font-medium lg:inline">Apply now</span>
        </Link>
      </nav>

      <Link
        href={accountHref}
        className="mb-1 flex items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-[#F8FAFC]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#007AFF]">
          <User className="h-4 w-4" />
        </span>
        <span className="hidden min-w-0 lg:block">
          <span className="block truncate text-sm font-semibold text-[#1E1E1E]">
            {authed ? displayName || "Account" : "Sign in"}
          </span>
          <span className="block text-xs text-[#6B7280]">
            {authed ? "Dashboard" : "Access your forms"}
          </span>
        </span>
      </Link>
    </aside>
  );
}

export function ExploreRightRail() {
  return (
    <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-[320px] shrink-0 overflow-y-auto py-4 pl-6 pr-2 xl:block">
      <div className="rounded-2xl border border-[#E8EEF5] bg-[#FAFCFF] px-4 py-3.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
          Get started
        </h2>
        <div className="mt-2 space-y-0.5">
          <Link
            href="/university-forms"
            className="block rounded-xl px-2 py-2.5 transition hover:bg-white"
          >
            <p className="text-sm font-semibold text-[#1E1E1E]">
              University forms
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-[#6B7280]">
              Buy application forms for schools
            </p>
          </Link>
          <Link
            href="/wassce-checker"
            className="block rounded-xl px-2 py-2.5 transition hover:bg-white"
          >
            <p className="text-sm font-semibold text-[#1E1E1E]">
              WASSCE checker
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-[#6B7280]">
              Purchase a PIN to check results
            </p>
          </Link>
          <Link
            href="/program-search"
            className="block rounded-xl px-2 py-2.5 transition hover:bg-white"
          >
            <p className="text-sm font-semibold text-[#1E1E1E]">
              Programme search
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-[#6B7280]">
              Find and compare courses
            </p>
          </Link>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[#E8EEF5] bg-[#FAFCFF] px-4 py-3.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
          Helpful
        </h2>
        <div className="mt-2 flex flex-col">
          <Link
            href="/about"
            className="rounded-xl px-2 py-2 text-sm font-medium text-[#1E1E1E] hover:bg-white hover:text-[#007AFF]"
          >
            About TertiaryGuide
          </Link>
          <Link
            href="/faqs"
            className="rounded-xl px-2 py-2 text-sm font-medium text-[#1E1E1E] hover:bg-white hover:text-[#007AFF]"
          >
            FAQs
          </Link>
          <Link
            href="/blog"
            className="rounded-xl px-2 py-2 text-sm font-medium text-[#1E1E1E] hover:bg-white hover:text-[#007AFF]"
          >
            Blog
          </Link>
          <Link
            href="/contact"
            className="rounded-xl px-2 py-2 text-sm font-medium text-[#1E1E1E] hover:bg-white hover:text-[#007AFF]"
          >
            Contact
          </Link>
        </div>
      </div>
    </aside>
  );
}

export function ExploreDesktopShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[1265px] justify-center md:px-2">
      <ExploreSideNav />
      <div className="min-w-0 w-full max-w-[600px] bg-[#F7F9FC] md:border-x md:border-[#E8EEF5]">
        <div className="sticky top-16 z-20 hidden border-b border-[#E8EEF5] bg-[#F7F9FC]/90 px-4 py-3 backdrop-blur md:block">
          <h1 className="text-lg font-semibold tracking-tight text-[#252525]">
            Explore
          </h1>
          <p className="mt-0.5 text-xs text-[#6B7280]">
            Scholarships, deadlines, and school news
          </p>
        </div>
        {children}
      </div>
      <ExploreRightRail />
    </div>
  );
}
