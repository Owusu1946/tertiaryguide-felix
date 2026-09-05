"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import {
  compareDeadlineForListing,
  isDeadlineCalendarExpired,
  isInApproachingWindow,
} from "@/lib/deadlines";
import { SchoolListLabel } from "@/app/components/SchoolListLabel";
import { catalogSchoolHref } from "@/lib/school-links";

type HomeDeadlineSchool = {
  id: string;
  name: string;
  alias: string | null;
  slug?: string | null;
  logoSrc: string | null;
  logoAlt: string | null;
  priceGhs: number | null;
  deadline: string | null;
  isPartner?: boolean;
  isVerified?: boolean;
};

function formatDeadline(deadline: string | null): string {
  if (!deadline) return "—";
  const date = new Date(deadline);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPrice(priceGhs: number | null): string {
  if (typeof priceGhs !== "number" || !Number.isFinite(priceGhs)) return "—";
  return `GHS ${priceGhs.toFixed(2)}`;
}

export function ApproachingDeadlinesSection() {
  const [schools, setSchools] = useState<HomeDeadlineSchool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/schools", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) {
          setSchools(Array.isArray(data.schools) ? data.schools : []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const APPROACHING_DAYS = 30;

  const byDeadlineThenName = (a: HomeDeadlineSchool, b: HomeDeadlineSchool) => {
    const byDeadline = compareDeadlineForListing(a.deadline, b.deadline);
    if (byDeadline !== 0) return byDeadline;
    return a.name.localeCompare(b.name);
  };

  const partnerSchools = schools
    .filter(
      (school) =>
        (school.isPartner || school.isVerified) &&
        !isDeadlineCalendarExpired(school.deadline),
    )
    .sort(byDeadlineThenName);

  const approachingCatalog = schools
    .filter(
      (school) =>
        !school.isPartner &&
        !school.isVerified &&
        isInApproachingWindow(school.deadline, APPROACHING_DAYS),
    )
    .sort(byDeadlineThenName)
    .slice(0, 20);

  const seen = new Set<string>();
  const approaching = [...partnerSchools, ...approachingCatalog]
    .filter((school) => {
      if (isDeadlineCalendarExpired(school.deadline)) return false;
      if (seen.has(school.id)) return false;
      seen.add(school.id);
      return true;
    })
    .sort((a, b) => {
      const byDeadline = compareDeadlineForListing(a.deadline, b.deadline);
      if (byDeadline !== 0) return byDeadline;
      if (Boolean(a.isPartner || a.isVerified) !== Boolean(b.isPartner || b.isVerified)) {
        return a.isPartner || a.isVerified ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

  const gridCols =
    "grid-cols-[minmax(0,1.4fr)_minmax(4.5rem,0.7fr)_minmax(5rem,0.8fr)] sm:grid-cols-[minmax(0,1.6fr)_minmax(6.5rem,0.7fr)_minmax(7rem,0.8fr)] md:grid-cols-[minmax(0,1.8fr)_minmax(7.5rem,0.65fr)_minmax(8rem,0.75fr)]";

  return (
    <section id="deadlines" className="mt-8 w-full min-w-0 scroll-mt-24 sm:mt-10">
      <h2 className="mb-3 text-balance text-center font-sans text-2xl font-semibold leading-tight text-[#252525] min-[400px]:mb-4 min-[400px]:text-3xl sm:text-4xl md:mb-5 md:text-5xl">
        Approaching Deadlines
      </h2>

      <div
        className={`grid min-w-0 ${gridCols} items-center gap-x-2 border-b border-[#E5E7EB] px-0 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-[#007AFF] sm:gap-x-4 sm:py-3 sm:text-sm md:text-base`}
        role="row"
      >
        <span className="min-w-0 text-left">School</span>
        <span className="text-right tabular-nums">Price</span>
        <span className="text-right tabular-nums">Deadline</span>
      </div>

      <div className="flex flex-col">
        {loading ? (
          <div className="border-b border-[#E5E7EB] px-0 py-10 text-center text-xs text-gray-400 sm:text-sm">
            Loading deadlines...
          </div>
        ) : approaching.length === 0 ? (
          <div className="border-b border-[#E5E7EB] px-0 py-10 text-center text-sm text-[#374151]">
            No application deadlines in the next {APPROACHING_DAYS} days.
          </div>
        ) : (
          approaching.map((school) => (
            <Link
              key={school.id}
              href={catalogSchoolHref(school)}
              aria-label={`${school.alias?.trim() || school.name} — ${formatPrice(school.priceGhs)} — deadline ${formatDeadline(school.deadline)}`}
              className={`group grid min-h-0 min-w-0 ${gridCols} items-center gap-x-2 border-b border-[#E5E7EB] bg-white px-0 py-3 text-inherit no-underline transition-all duration-150 [touch-action:manipulation] hover:rounded-2xl hover:bg-[#007AFF] hover:px-2.5 hover:text-white active:rounded-2xl active:bg-[#007AFF] active:px-2.5 active:text-white sm:gap-x-4 sm:py-3.5 sm:hover:px-3.5 sm:active:px-3.5`}
            >
              <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
                {school.logoSrc && (
                  <div className="relative h-5 w-5 shrink-0 rounded-sm transition group-hover:bg-white/95 group-hover:shadow-sm sm:h-7 sm:w-7 sm:group-hover:p-0.5">
                    <Image
                      src={school.logoSrc}
                      alt={school.logoAlt ?? school.name}
                      width={32}
                      height={32}
                      className="h-full w-full object-contain"
                    />
                  </div>
                )}
                <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden sm:gap-1.5">
                  <SchoolListLabel
                    name={school.name}
                    alias={school.alias}
                    className="min-w-0 text-left text-[13px] font-medium leading-snug text-[#252525] group-hover:text-white sm:text-sm sm:break-words sm:[overflow-wrap:anywhere]"
                  />
                  {(school.isVerified || school.isPartner) && (
                    <BadgeCheck
                      className="h-3.5 w-3.5 shrink-0 text-[#007AFF] group-hover:text-white sm:h-4 sm:w-4"
                      fill="currentColor"
                      stroke="white"
                    />
                  )}
                </div>
              </div>

              <span className="w-full text-right text-[11px] font-medium tabular-nums leading-none text-[#252525] group-hover:text-white sm:text-sm">
                {formatPrice(school.priceGhs)}
              </span>

              <span className="w-full text-right text-[11px] font-medium tabular-nums leading-none text-[#252525] group-hover:text-white sm:text-sm">
                {formatDeadline(school.deadline)}
              </span>
            </Link>
          ))
        )}
      </div>

      {!loading && (
        <div className="mt-4 flex justify-center sm:mt-5">
          <Link
            href="/university-forms"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#007AFF] underline-offset-4 transition hover:text-[#0062CC] hover:underline"
          >
            View all forms
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
          </Link>
        </div>
      )}
    </section>
  );
}
