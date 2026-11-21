"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, GraduationCap, Loader2 } from "lucide-react";
import { isDeadlineCalendarExpired } from "@/lib/deadlines";
import { SchoolListLabel } from "@/app/components/SchoolListLabel";

type PartnerSchool = {
  id: string;
  name: string;
  alias: string | null;
  slug: string | null;
  logoSrc: string | null;
  logoAlt: string | null;
  description: string | null;
  voucherPrice: number | null;
  undergraduateVoucherPrice?: number | null;
  postgraduateVoucherPrice?: number | null;
  requiresVoucher: boolean;
  deadline: string | null;
  isVerified?: boolean;
};

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

function formatPrice(priceGhs: number | null | undefined): string {
  if (typeof priceGhs !== "number" || !Number.isFinite(priceGhs)) return "—";
  return `GHS ${priceGhs.toFixed(2)}`;
}

function schoolHref(school: PartnerSchool) {
  if (school.slug) return `/apply/school/${encodeURIComponent(school.slug)}`;
  return `/apply?school=${encodeURIComponent(school.id)}`;
}

export function PartnerSchoolsSection({
  variant = "list",
}: {
  variant?: "list" | "cards";
}) {
  const [schools, setSchools] = useState<PartnerSchool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/apply/schools", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && res.ok) {
          setSchools(Array.isArray(data.schools) ? data.schools : []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && schools.length === 0) return null;

  if (variant === "cards") {
    return (
      <section className="w-full min-w-0 space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#007AFF]">
              Featured schools
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#252525] sm:text-xl">
              Institutions accepting applications
            </h2>
          </div>
          <Link
            href="/apply"
            className="shrink-0 text-sm font-semibold text-[#007AFF] hover:underline"
          >
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#94A3B8]">
            <Loader2 className="h-5 w-5 animate-spin text-[#007AFF]" />
            Loading institutions…
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {schools.map((school) => {
              const expired = isDeadlineCalendarExpired(school.deadline);
              const price =
                school.undergraduateVoucherPrice ?? school.voucherPrice ?? null;
              const cardClass =
                "group flex flex-col overflow-hidden rounded-2xl border border-[#E8EEF5] bg-white p-3 shadow-sm sm:p-4";
              const body = (
                <>
                  <div className="flex items-start gap-2.5">
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-[#F8FAFC] ring-1 ring-[#EEF2F7] sm:h-12 sm:w-12">
                      {school.logoSrc ? (
                        <Image
                          src={school.logoSrc}
                          alt={school.logoAlt ?? school.name}
                          fill
                          className="object-contain p-1"
                          sizes="48px"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[#007AFF]">
                          <GraduationCap className="h-5 w-5" />
                        </span>
                      )}
                    </div>
                    <BadgeCheck
                      className="ml-auto h-4 w-4 shrink-0 text-[#007AFF]"
                      fill="currentColor"
                      stroke="white"
                      aria-label="Verified partner school"
                    />
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-[#1E1E1E]">
                    {school.alias?.trim() || school.name}
                  </p>
                  <p
                    className={`mt-1 text-[11px] font-medium ${
                      expired ? "text-red-600" : "text-[#6B7280]"
                    }`}
                  >
                    {expired
                      ? "Applications closed"
                      : formatDeadline(school.deadline)}
                  </p>
                  <p
                    className={`mt-auto pt-2 text-xs font-semibold ${
                      expired ? "text-[#9CA3AF]" : "text-[#007AFF]"
                    }`}
                  >
                    {expired ? "Not available" : formatPrice(price)}
                  </p>
                </>
              );
              if (expired) {
                return (
                  <div
                    key={school.id}
                    className={`${cardClass} opacity-80`}
                    aria-disabled="true"
                    title="This school's application deadline has passed"
                  >
                    {body}
                  </div>
                );
              }
              return (
                <Link
                  key={school.id}
                  href={schoolHref(school)}
                  className={`${cardClass} transition hover:border-[#BFDBFE] hover:shadow-md`}
                >
                  {body}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  const gridCols =
    "grid-cols-[minmax(0,1.4fr)_minmax(4.5rem,0.7fr)_minmax(5rem,0.8fr)] sm:grid-cols-[minmax(0,1.6fr)_minmax(6.5rem,0.7fr)_minmax(7rem,0.8fr)] md:grid-cols-[minmax(0,1.8fr)_minmax(7.5rem,0.65fr)_minmax(8rem,0.75fr)]";

  return (
    <section className="w-full min-w-0 space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#007AFF]">
            Direct applications
          </p>
          <h2 className="mt-1 text-balance text-2xl font-semibold leading-tight tracking-tight text-[#252525] md:text-3xl">
            Institutions accepting applications online
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#666] md:text-base">
            Apply through the official TertiaryGuide admissions portal. Purchase
            a voucher, submit your form, and track your application in one place.
          </p>
        </div>
        <Link
          href="/apply"
          className="shrink-0 text-sm font-semibold text-[#007AFF] hover:underline"
        >
          View all applications →
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 border-b border-[#E5E7EB] py-12 text-sm text-[#94A3B8]">
          <Loader2 className="h-5 w-5 animate-spin text-[#007AFF]" />
          Loading institutions…
        </div>
      ) : (
        <div className="w-full min-w-0">
          <div
            className={`grid min-w-0 ${gridCols} items-center gap-x-2 border-b border-[#E5E7EB] px-0 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-[#007AFF] sm:gap-x-4 sm:py-3 sm:text-sm md:text-base`}
            role="row"
          >
            <span className="min-w-0 text-left">School</span>
            <span className="text-right tabular-nums">Price</span>
            <span className="text-right tabular-nums">Deadline</span>
          </div>

          <div className="flex flex-col">
            {schools.map((school) => {
              const expired = isDeadlineCalendarExpired(school.deadline);
              const price =
                school.undergraduateVoucherPrice ??
                school.voucherPrice ??
                null;
              const rowClass = `group grid min-h-0 min-w-0 ${gridCols} items-center gap-x-2 border-b border-[#E5E7EB] bg-white px-0 py-3 text-inherit no-underline sm:gap-x-4 sm:py-3.5`;
              const interactiveClass =
                "transition-all duration-150 [touch-action:manipulation] hover:rounded-2xl hover:bg-[#007AFF] hover:px-2.5 hover:text-white active:rounded-2xl active:bg-[#007AFF] active:px-2.5 active:text-white sm:hover:px-3.5 sm:active:px-3.5";

              const rowBody = (
                <>
                  <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
                    <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded-sm transition group-hover:bg-white/95 group-hover:shadow-sm sm:h-7 sm:w-7 sm:group-hover:p-0.5">
                      {school.logoSrc ? (
                        <Image
                          src={school.logoSrc}
                          alt={school.logoAlt ?? school.name}
                          width={32}
                          height={32}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[#007AFF] group-hover:text-[#007AFF]">
                          <GraduationCap className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                    <SchoolListLabel
                      name={school.name}
                      alias={school.alias}
                      className="min-w-0 text-left text-[13px] font-medium leading-snug text-[#252525] group-hover:text-white sm:text-sm sm:break-words sm:[overflow-wrap:anywhere]"
                    />
                    <BadgeCheck
                      className="h-3.5 w-3.5 shrink-0 text-[#007AFF] group-hover:text-white sm:h-4 sm:w-4"
                      fill="currentColor"
                      stroke="white"
                      aria-label="Verified partner school"
                    />
                  </div>

                  <span className="w-full text-right text-[11px] font-medium tabular-nums leading-none text-[#252525] group-hover:text-white sm:text-sm">
                    {formatPrice(price)}
                  </span>

                  <span
                    className={`w-full text-right text-[11px] font-medium tabular-nums leading-none sm:text-sm ${
                      expired
                        ? "text-red-600"
                        : "text-[#252525] group-hover:text-white"
                    }`}
                  >
                    {expired ? (
                      <>
                        <span className="sm:hidden">Closed</span>
                        <span className="hidden sm:inline">
                          Applications closed
                        </span>
                      </>
                    ) : (
                      formatDeadline(school.deadline)
                    )}
                  </span>
                </>
              );

              if (expired) {
                return (
                  <div
                    key={school.id}
                    className={`${rowClass} cursor-not-allowed opacity-80`}
                    aria-disabled="true"
                    title="This school's application deadline has passed"
                  >
                    {rowBody}
                  </div>
                );
              }

              return (
                <Link
                  key={school.id}
                  href={schoolHref(school)}
                  aria-label={`${school.alias?.trim() || school.name} — ${formatPrice(price)} — deadline ${formatDeadline(school.deadline)}`}
                  className={`${rowClass} ${interactiveClass}`}
                >
                  {rowBody}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
