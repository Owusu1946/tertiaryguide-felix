"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, BadgeCheck, Loader2 } from "lucide-react";
import { Header } from "../components/Header";
import { FaqSection } from "../components/FaqSection";
import { Footer } from "../components/Footer";
import {
  compareDeadlineForListing,
  isDeadlineCalendarExpired,
} from "@/lib/deadlines";
import { SchoolListLabel } from "@/app/components/SchoolListLabel";
import {
  ProgrammeLevelFilter,
  priceForProgrammeLevel,
  schoolMatchesProgrammeLevel,
  type ProgrammeLevelFilterValue,
} from "@/app/components/ProgrammeLevelFilter";
import { catalogSchoolHref } from "@/lib/school-links";
import { SCHOOL_CATEGORIES } from "@/lib/schoolCategories";

type UniversityFormSchool = {
  id: string;
  name: string;
  alias: string | null;
  slug?: string | null;
  logoSrc: string | null;
  logoAlt: string | null;
  priceGhs: number | null;
  undergraduateVoucherPrice?: number | null;
  postgraduateVoucherPrice?: number | null;
  deadline: string | null;
  isVerified?: boolean;
  isPartner?: boolean;
  /** @deprecated use categories; still set for older clients */
  category?: string;
  categories?: string[];
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

const requestFieldClass =
  "w-full min-h-[48px] rounded-xl border-2 border-[#94A3B8] bg-white px-4 py-3 text-base text-[#0F172A] outline-none transition placeholder:text-[#64748B] hover:border-[#64748B] focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/25 sm:min-h-11 sm:py-2.5 sm:text-sm";

const requestLabelClass =
  "mb-1.5 block text-sm font-medium text-[#334155]";

export default function UniversityFormsPage() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [programmeLevel, setProgrammeLevel] =
    useState<ProgrammeLevelFilterValue>("all");
  const [schools, setSchools] = useState<UniversityFormSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);

  const [requestName, setRequestName] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [requestPhone, setRequestPhone] = useState("");
  const [requestInstitution, setRequestInstitution] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [requestHp, setRequestHp] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function refreshFromNetwork() {
      try {
        setError(null);
        const res = await fetch("/api/schools", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load forms");
        if (!cancelled) setSchools(Array.isArray(data.schools) ? data.schools : []);
      } catch {
        if (!cancelled) setError("Could not load forms. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    refreshFromNetwork();
    return () => { cancelled = true; };
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredSchools = schools.filter((school) => {
    const matchesSearch =
      !normalizedQuery ||
      school.name.toLowerCase().includes(normalizedQuery) ||
      (school.alias ?? "").toLowerCase().includes(normalizedQuery);
    const schoolCats =
      school.categories && school.categories.length > 0
        ? school.categories
        : school.category
          ? [school.category]
          : [];
    const matchesCategory =
      activeTab === "All" || schoolCats.includes(activeTab);
    const matchesLevel = schoolMatchesProgrammeLevel(school, programmeLevel);
    return matchesSearch && matchesCategory && matchesLevel;
  });

  const listedSchools = [...filteredSchools].sort((a, b) => {
    const byDeadline = compareDeadlineForListing(a.deadline, b.deadline);
    if (byDeadline !== 0) return byDeadline;
    if (Boolean(a.isPartner) !== Boolean(b.isPartner)) {
      return a.isPartner ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  const formsGridCols =
    "grid-cols-[minmax(0,1.4fr)_minmax(4.5rem,0.7fr)_minmax(5rem,0.8fr)] sm:grid-cols-[minmax(0,1.6fr)_minmax(6.5rem,0.7fr)_minmax(7rem,0.8fr)] md:grid-cols-[minmax(0,1.8fr)_minmax(7.5rem,0.65fr)_minmax(8rem,0.75fr)]";

  async function handleRequestInstitution(e: React.FormEvent) {
    e.preventDefault();
    setRequestError(null);
    setRequestSubmitting(true);
    try {
      const res = await fetch("/api/university-forms/request-institution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterName: requestName.trim(),
          requesterEmail: requestEmail.trim() || undefined,
          requesterPhone: requestPhone.trim() || undefined,
          institutionName: requestInstitution.trim(),
          message: requestMessage.trim() || undefined,
          _hp: requestHp,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Request failed.",
        );
      }
      setRequestSuccess(true);
      setRequestName("");
      setRequestEmail("");
      setRequestPhone("");
      setRequestInstitution("");
      setRequestMessage("");
    } catch (err) {
      setRequestError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setRequestSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-[#1E1E1E]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pb-8 sm:px-6 md:gap-5 md:px-10 md:pb-10">
        <Header />

        <main className="space-y-8 sm:space-y-10">
          <section className="flex flex-col gap-4 sm:gap-6 md:flex-row md:items-center md:justify-between">
            <h1 className="max-w-[min(100%,24rem)] text-balance text-2xl font-semibold leading-tight min-[400px]:text-3xl md:max-w-xl md:text-4xl">
              Get a form to your <br className="max-[380px]:hidden" />
              preferred university
            </h1>

            <div className="flex w-full min-h-[48px] max-w-sm items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm transition-all duration-200 focus-within:border-[#007AFF] focus-within:ring-4 focus-within:ring-[#007AFF]/10 md:shrink-0">
            <Search className="h-4 w-4 shrink-0 text-gray-400 transition-colors group-focus-within:text-[#007AFF]" />
            <input
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find different forms"
              className="w-full min-w-0 bg-transparent text-sm font-medium text-[#1E1E1E] outline-none placeholder:text-gray-400"
            />
          </div>
          </section>

          <section className="space-y-4 sm:space-y-6">
            <div className="space-y-3">
              <div
                className="flex w-full gap-2 overflow-x-auto overscroll-x-contain scroll-pb-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:gap-6 sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden"
                role="tablist"
                aria-label="Filter by category"
              >
                {["All", ...SCHOOL_CATEGORIES].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab}
                    onClick={() => setActiveTab(tab)}
                    className={`shrink-0 rounded-full px-3 py-2 text-xs font-medium transition [touch-action:manipulation] active:scale-[0.98] sm:rounded-none sm:px-0 sm:py-0 sm:pb-1 sm:text-sm ${
                      activeTab === tab
                        ? "bg-[#007AFF] text-white shadow-sm hover:bg-[#0066D6] hover:text-white sm:border-b-2 sm:border-[#007AFF] sm:bg-transparent sm:pb-1 sm:pt-0 sm:text-[#007AFF] sm:shadow-none sm:hover:bg-transparent sm:hover:text-[#007AFF]"
                        : "bg-gray-100/80 text-[#555555] hover:text-[#007AFF] sm:bg-transparent"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <ProgrammeLevelFilter
                value={programmeLevel}
                onChange={setProgrammeLevel}
              />
            </div>

            <div className="w-full min-w-0">
              <div
                className={`grid min-w-0 ${formsGridCols} items-center gap-x-2 border-b border-[#E5E7EB] px-0 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-[#007AFF] sm:gap-x-4 sm:py-3 sm:text-sm md:text-base`}
                role="row"
              >
                <span className="min-w-0 text-left">School</span>
                <span className="text-right tabular-nums">Price</span>
                <span className="text-right tabular-nums">Deadline</span>
              </div>

              <div className="flex flex-col">
                {loading ? (
                  <div className="border-b border-[#E5E7EB] px-0 py-10 text-center text-xs text-gray-400 sm:text-sm">
                    Loading forms...
                  </div>
                ) : listedSchools.length === 0 ? (
                  <div className="border-b border-[#E5E7EB] px-0 py-10 text-center text-sm text-[#374151]">
                    No forms match your search.
                  </div>
                ) : (
                  listedSchools.map((form) => {
                    const expired = isDeadlineCalendarExpired(form.deadline);
                    const displayPrice = priceForProgrammeLevel(
                      form,
                      programmeLevel,
                    );

                    return (
                      <Link
                        key={form.id}
                        href={catalogSchoolHref(form, programmeLevel)}
                        className={`group grid min-h-0 min-w-0 ${formsGridCols} items-center gap-x-2 border-b border-[#E5E7EB] bg-white px-0 py-3 text-inherit no-underline transition-all duration-150 [touch-action:manipulation] hover:rounded-2xl hover:bg-[#007AFF] hover:px-2.5 hover:text-white active:rounded-2xl active:bg-[#007AFF] active:px-2.5 active:text-white sm:gap-x-4 sm:py-3.5 sm:hover:px-3.5 sm:active:px-3.5`}
                      >
                        <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
                          {form.logoSrc && (
                            <div className="relative h-5 w-5 shrink-0 rounded-sm transition group-hover:bg-white/95 group-hover:shadow-sm sm:h-7 sm:w-7 sm:group-hover:p-0.5">
                              <Image
                                src={form.logoSrc}
                                alt={form.logoAlt ?? form.name}
                                width={32}
                                height={32}
                                className="h-full w-full object-contain"
                              />
                            </div>
                          )}
                          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden sm:gap-1.5">
                            <SchoolListLabel
                              name={form.name}
                              alias={form.alias}
                              className="min-w-0 text-left text-[13px] font-medium leading-snug text-[#252525] group-hover:text-white sm:text-sm sm:break-words sm:[overflow-wrap:anywhere]"
                            />
                            {(form.isVerified || form.isPartner) && (
                              <BadgeCheck
                                className="h-3.5 w-3.5 shrink-0 text-[#007AFF] group-hover:text-white sm:h-4 sm:w-4"
                                fill="currentColor"
                                stroke="white"
                              />
                            )}
                          </div>
                        </div>

                        <span className="w-full text-right text-[11px] font-medium tabular-nums leading-none text-[#252525] group-hover:text-white sm:text-sm">
                          {displayPrice !== null
                            ? `GHS ${displayPrice.toFixed(2)}`
                            : "—"}
                        </span>

                        <span
                          className={`w-full text-right text-[11px] font-medium tabular-nums leading-none sm:text-sm ${
                            expired
                              ? "text-red-600 group-hover:text-white"
                              : "text-[#252525] group-hover:text-white"
                          }`}
                        >
                          {formatDeadline(form.deadline)}
                        </span>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          <section className="border-t border-gray-100 pt-8 pb-4 sm:pt-10 md:pt-12">
            <div className="mx-auto max-w-3xl">
              <h2 className="text-balance text-lg font-semibold leading-snug text-[#1E1E1E] min-[400px]:text-xl">
                Still can&apos;t find the institution you&apos;re looking for?
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#475569]">
                Browse the schools listed above first. If yours is not listed,
                request it here and we&apos;ll review adding it when we can.
              </p>

              {requestSuccess ? (
                <div className="mt-6 space-y-3" role="status">
                  <div className="rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-sm text-[#166534]">
                    Thanks! We&apos;ve received your request. If you left
                    contact details, we may reach out when this institution is
                    available on TertiaryGuide.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRequestSuccess(false);
                      setRequestError(null);
                    }}
                    className="text-sm font-medium text-[#007AFF] hover:underline"
                  >
                    Submit another request
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleRequestInstitution}
                  className="mt-6 grid gap-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 sm:grid-cols-2 sm:gap-5 sm:p-6"
                >
                  <input
                    type="text"
                    name="company"
                    value={requestHp}
                    onChange={(e) => setRequestHp(e.target.value)}
                    className="hidden"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                  />
                  <div>
                    <label htmlFor="req-name" className={requestLabelClass}>
                      Your full name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="req-name"
                      type="text"
                      required
                      value={requestName}
                      onChange={(e) => setRequestName(e.target.value)}
                      autoComplete="name"
                      maxLength={120}
                      className={requestFieldClass}
                      placeholder="e.g. Ama Serwaa"
                    />
                  </div>
                  <div>
                    <label htmlFor="req-inst" className={requestLabelClass}>
                      School or institution you want{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="req-inst"
                      type="text"
                      required
                      value={requestInstitution}
                      onChange={(e) => setRequestInstitution(e.target.value)}
                      maxLength={200}
                      className={requestFieldClass}
                      placeholder="e.g. University of …"
                    />
                  </div>
                  <div>
                    <label htmlFor="req-email" className={requestLabelClass}>
                      Email
                    </label>
                    <input
                      id="req-email"
                      type="email"
                      value={requestEmail}
                      onChange={(e) => setRequestEmail(e.target.value)}
                      autoComplete="email"
                      className={requestFieldClass}
                      placeholder="you@example.com (optional)"
                    />
                  </div>
                  <div>
                    <label htmlFor="req-phone" className={requestLabelClass}>
                      Phone
                    </label>
                    <input
                      id="req-phone"
                      type="tel"
                      value={requestPhone}
                      onChange={(e) => setRequestPhone(e.target.value)}
                      autoComplete="tel"
                      maxLength={30}
                      className={requestFieldClass}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="req-msg" className={requestLabelClass}>
                      Additional details
                    </label>
                    <textarea
                      id="req-msg"
                      value={requestMessage}
                      onChange={(e) => setRequestMessage(e.target.value)}
                      maxLength={2000}
                      rows={4}
                      className={`${requestFieldClass} min-h-[6.5rem] resize-y`}
                      placeholder="Programme type, level, or anything else that helps (optional)"
                    />
                  </div>
                  {requestError ? (
                    <p
                      className="text-sm text-red-600 sm:col-span-2"
                      role="alert"
                    >
                      {requestError}
                    </p>
                  ) : null}
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={requestSubmitting}
                      className="inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#007AFF] px-5 py-3 text-base font-semibold text-white shadow-sm transition [touch-action:manipulation] hover:bg-[#0066D6] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 sm:min-h-0 sm:w-auto sm:text-sm"
                    >
                      {requestSubmitting ? (
                        <>
                          <Loader2
                            className="h-4 w-4 shrink-0 animate-spin"
                            aria-hidden
                          />
                          Sending…
                        </>
                      ) : (
                        "Send request"
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </section>
        </main>
      </div>
      <FaqSection />
      <Footer />
    </div>
  );
}