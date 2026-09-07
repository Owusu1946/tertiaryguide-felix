"use client";

import React from "react";
import {
  Instagram,
  Facebook,
  Twitter,
  Send,
  Copyright,
  Youtube,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const MY_FORMS_PATH = "/dashboard/my-forms";
const MY_APPLICATIONS_PATH = "/dashboard/my-applications";
const MY_CHECKERS_PATH = "/dashboard/my-checkers";
const SIGNIN_TO_MY_FORMS = `/signin?redirect=${encodeURIComponent(MY_FORMS_PATH)}`;
const SIGNIN_TO_MY_APPLICATIONS = `/signin?redirect=${encodeURIComponent(MY_APPLICATIONS_PATH)}`;
const SIGNIN_TO_MY_CHECKERS = `/signin?redirect=${encodeURIComponent(MY_CHECKERS_PATH)}`;

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

const sectionTitleClass =
  "text-xs font-semibold uppercase tracking-[0.14em] text-white/55 lg:text-[13px]";

const footerLinkClass =
  "whitespace-nowrap text-sm font-medium text-white/95 transition-colors hover:text-white hover:underline lg:text-[15px]";

const socialLinkClass =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/12 text-white ring-1 ring-white/10 transition-colors hover:bg-white/20 lg:h-11 lg:w-11";

const contactRowClass =
  "flex items-start gap-3 text-sm text-white/90 lg:text-[15px]";

const mobileDividerClass = "border-t border-white/10 pt-8 lg:border-0 lg:pt-0";

const desktopColumnClass =
  "lg:border-l lg:border-white/10 lg:pl-10 xl:pl-12";

export function Footer() {
  const [myFormsHref, setMyFormsHref] = React.useState(SIGNIN_TO_MY_FORMS);
  const [myApplicationsHref, setMyApplicationsHref] = React.useState(
    SIGNIN_TO_MY_APPLICATIONS,
  );
  const [myCheckersHref, setMyCheckersHref] = React.useState(
    SIGNIN_TO_MY_CHECKERS,
  );

  React.useEffect(() => {
    const sync = () => {
      if (typeof window === "undefined") return;
      const email = window.localStorage.getItem("tg_user_email");
      setMyFormsHref(email ? MY_FORMS_PATH : SIGNIN_TO_MY_FORMS);
      setMyApplicationsHref(
        email ? MY_APPLICATIONS_PATH : SIGNIN_TO_MY_APPLICATIONS,
      );
      setMyCheckersHref(email ? MY_CHECKERS_PATH : SIGNIN_TO_MY_CHECKERS);
    };
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "tg_user_email") sync();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/blog", label: "Blog" },
    { href: "/faqs", label: "FAQs" },
    { href: "/university-forms", label: "University Forms" },
    { href: "/wassce-checker", label: "WASSCE Checkers" },
    { href: "/program-search", label: "Program Search" },
    { href: myFormsHref, label: "My Forms" },
    { href: myApplicationsHref, label: "My Applications" },
    { href: myCheckersHref, label: "My Checkers" },
    { href: "/contact", label: "Contact Us" },
  ];

  const socialLinks = [
    {
      href: "https://www.instagram.com/tertiaryguide1?igsh=MXJud3dpZnlieTY0aA==",
      label: "Instagram",
      icon: Instagram,
    },
    {
      href: "https://www.facebook.com/share/1EAdiVWy5T/",
      label: "Facebook",
      icon: Facebook,
    },
    {
      href: "https://x.com/TertiaryGuide1",
      label: "Twitter",
      icon: Twitter,
    },
    {
      href: "https://www.tiktok.com/@tertiaryguide?_r=1&_t=ZS-93DA0f3pjWf",
      label: "TikTok",
      icon: TikTokIcon,
    },
    {
      href: "https://youtube.com/@tertiaryguide?si=td4FYwui6npd-eo0",
      label: "YouTube",
      icon: Youtube,
    },
  ];

  return (
    <footer id="footer" className="bg-[#007AFF] text-white">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 md:px-10 lg:px-12 lg:py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-x-10 md:gap-y-10 lg:grid-cols-4 lg:gap-12">
          <section className="flex flex-col items-center text-center md:col-span-2 md:items-start md:text-left lg:col-span-1">
            <Link
              href="/"
              className="inline-flex transition-opacity hover:opacity-90"
            >
              <Image
                src="/hero/full-logo.png"
                alt="TertiaryGuide"
                width={1024}
                height={189}
                className="h-8 w-auto brightness-0 invert lg:h-9"
              />
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/75 lg:mt-5 lg:text-[15px] lg:leading-7">
              Your trusted resource to higher education — university forms, programmes, and WASSCE checkers in Ghana.
            </p>
          </section>

          <section
            className={`space-y-4 text-center md:text-left ${mobileDividerClass} ${desktopColumnClass}`}
          >
            <p className={sectionTitleClass}>Quick Links</p>
            <nav className="mx-auto grid max-w-xs grid-cols-2 gap-x-6 gap-y-3 text-left md:mx-0 md:max-w-none md:grid-cols-1 md:gap-y-2.5 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-3">
              {navLinks.map((item) => (
                <Link key={item.label} href={item.href} className={footerLinkClass}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </section>

          <section
            className={`space-y-4 text-center md:text-left ${mobileDividerClass} ${desktopColumnClass}`}
          >
            <p className={sectionTitleClass}>Main Office</p>
            <div className="mx-auto w-full max-w-xs space-y-3.5 md:mx-0 md:max-w-none lg:space-y-4">
              <p className={contactRowClass}>
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/70 lg:h-[18px] lg:w-[18px]" />
                <span>Ho, Trafalgar, Ghana</span>
              </p>
              <p className={contactRowClass}>
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-white/70 lg:h-[18px] lg:w-[18px]" />
                <a href="tel:+233595110767" className="hover:underline">
                  +233 59 511 0767
                </a>
              </p>
              <p className={contactRowClass}>
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-white/70 lg:h-[18px] lg:w-[18px]" />
                <a href="tel:+233248967314" className="hover:underline">
                  +233 24 896 7314
                </a>
              </p>
              <p className={contactRowClass}>
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-white/70 lg:h-[18px] lg:w-[18px]" />
                <a
                  href="mailto:info@tertiaryguide.com"
                  className="break-all hover:underline md:break-normal"
                >
                  info@tertiaryguide.com
                </a>
              </p>
            </div>
          </section>

          <section
            className={`space-y-4 text-center md:col-span-2 md:text-left lg:col-span-1 ${mobileDividerClass} ${desktopColumnClass}`}
          >
            <p className={sectionTitleClass}>Stay In Touch</p>
            <p className="mx-auto max-w-sm text-sm leading-relaxed text-white/75 md:mx-0 lg:text-[15px] lg:leading-7">
              Follow us for admission updates, tips, and deadline reminders.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5 md:justify-start lg:gap-3">
              <button
                type="button"
                aria-label="Telegram"
                className={socialLinkClass}
              >
                <Send className="h-4 w-4 lg:h-[18px] lg:w-[18px]" />
              </button>
              {socialLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.label}
                    className={socialLinkClass}
                  >
                    <Icon className="h-4 w-4 lg:h-[18px] lg:w-[18px]" />
                  </Link>
                );
              })}
            </div>
          </section>
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 border-t border-white/10 pt-6 text-center text-xs text-white/65 lg:mt-12 lg:flex-row lg:justify-between lg:pt-8 lg:text-sm">
          <div className="flex items-center justify-center gap-1.5 lg:justify-start">
            <Copyright className="h-3.5 w-3.5 shrink-0 lg:h-4 lg:w-4" />
            <span>TertiaryGuide 2026. All rights reserved.</span>
          </div>
          <div className="flex items-center justify-center gap-5 lg:gap-6">
            <Link href="/privacy" className="transition-colors hover:text-white hover:underline">
              Privacy policy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-white hover:underline">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
