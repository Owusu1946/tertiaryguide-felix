"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, BadgeCheck, Loader2 } from "lucide-react";
import { Header } from "@/app/components/Header";
import { Footer } from "@/app/components/Footer";
import { AuthModal } from "@/app/components/AuthModal";
import { CutoffModal } from "@/app/components/CutoffModal";
import { isDeadlineCalendarExpired } from "@/lib/deadlines";
import {
  brandThemeStyle,
} from "@/lib/brand-theme";
import {
  getStoredUserEmail,
  getStoredUserName,
} from "@/lib/client-auth";
import {
  PROGRAMME_LEVEL_LABELS,
  type ProgrammeLevel,
} from "@/lib/admissions/programme-level";

type PartnerSchool = {
  id: string;
  name: string;
  alias: string | null;
  slug: string | null;
  logoSrc: string | null;
  logoAlt: string | null;
  description: string | null;
  about: string | null;
  deadline: string | null;
  voucherPrice: number | null;
  undergraduateVoucherPrice?: number | null;
  postgraduateVoucherPrice?: number | null;
  requiresVoucher: boolean;
  brandColor?: string | null;
  brandColors?: string[] | null;
};

function formatDeadline(deadline: string | null): string {
  if (!deadline) return "—";
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return deadline;
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function PartnerSchoolDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;

  const [school, setSchool] = useState<PartnerSchool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voucherFullName, setVoucherFullName] = useState("");
  const [voucherEmail, setVoucherEmail] = useState("");
  const [programmeLevel, setProgrammeLevel] = useState<ProgrammeLevel | "">("");
  const [voucherSubmitting, setVoucherSubmitting] = useState(false);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [showCutoffModal, setShowCutoffModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `/api/apply/schools/${encodeURIComponent(slug)}`,
          { cache: "no-store" },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "School not found");
        if (!cancelled) setSchool(data.school);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load school");
          setSchool(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();

    const email = getStoredUserEmail();
    setAccountEmail(email);
    if (email) {
      setVoucherEmail(email);
      const name = getStoredUserName();
      if (name) setVoucherFullName(name);
      void fetch(`/api/user/me?email=${encodeURIComponent(email)}`)
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled && data?.user?.username) {
            setVoucherFullName(data.user.username);
          }
        })
        .catch(() => undefined);
    }

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const displayName = school?.alias?.trim() || school?.name || "";
  const aboutText = school?.description || school?.about || "";
  const aboutParagraphs = useMemo(
    () =>
      aboutText
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter(Boolean),
    [aboutText],
  );

  const applyHref = school
    ? `/apply?school=${encodeURIComponent(school.slug || school.id)}`
    : "/apply";
  const loginHref = `${applyHref}&step=login`;

  const selectedPrice = useMemo(() => {
    if (!school || !programmeLevel) return null;
    if (programmeLevel === "postgraduate") {
      return (
        school.postgraduateVoucherPrice ??
        school.voucherPrice ??
        null
      );
    }
    return (
      school.undergraduateVoucherPrice ??
      school.voucherPrice ??
      null
    );
  }, [school, programmeLevel]);

  function handleBuyVoucher() {
    if (!school) return;

    const email = getStoredUserEmail();
    if (!email) {
      setShowAuthModal(true);
      return;
    }

    if (!voucherFullName.trim() || !voucherEmail.trim()) {
      setVoucherError("Please enter your full name and email.");
      return;
    }

    if (!programmeLevel) {
      setVoucherError("Please select Undergraduate or Postgraduate.");
      return;
    }

    setVoucherError(null);
    setShowSummaryModal(true);
  }

  async function confirmAndPay() {
    if (!school || !programmeLevel) return;
    const accountEmail = getStoredUserEmail();
    if (!accountEmail) {
      setShowSummaryModal(false);
      setShowAuthModal(true);
      return;
    }

    try {
      setVoucherSubmitting(true);
      setVoucherError(null);

      const res = await fetch("/api/apply/voucher/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: voucherFullName.trim(),
          email: accountEmail,
          schoolId: school.id,
          programmeLevel,
          returnOrigin: window.location.origin,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setVoucherError(
          data.error || "Could not start payment. Please try again.",
        );
        setShowSummaryModal(false);
        return;
      }

      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl as string;
      } else {
        setVoucherError("Unexpected response from payment gateway.");
        setShowSummaryModal(false);
      }
    } catch {
      setVoucherError("Something went wrong. Please try again.");
      setShowSummaryModal(false);
    } finally {
      setVoucherSubmitting(false);
    }
  }

  const deadlineExpired = school
    ? isDeadlineCalendarExpired(school.deadline)
    : false;
  const themeStyle = brandThemeStyle({
    brandColor: school?.brandColor,
    brandColors: school?.brandColors,
  });

  return (
    <div className="min-h-screen bg-white text-[#1E1E1E]" style={themeStyle}>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pb-8 sm:px-6 md:gap-5 md:px-10 md:pb-10">
        <Header />

        {school && (
          <CutoffModal
            isOpen={showCutoffModal}
            onClose={() => setShowCutoffModal(false)}
            schoolName={school.name}
            schoolId={school.id}
            source="partner"
          />
        )}

        <main className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <section className="max-w-2xl space-y-6 text-sm leading-relaxed md:text-base">
            {loading ? (
              <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
                Loading...
              </h1>
            ) : error ? (
              <>
                <h1 className="text-2xl font-semibold text-[#B91C1C]">
                  Something went wrong
                </h1>
                <p className="text-sm text-[#6B7280]">{error}</p>
              </>
            ) : !school ? (
              <>
                <h1 className="text-2xl font-semibold">School not found</h1>
                <p className="text-sm text-[#6B7280]">
                  This institution is not available right now.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-start gap-4 md:hidden">
                  {school.logoSrc && (
                    <div className="shrink-0 rounded-2xl border border-[#F0F0F0] bg-white p-2 shadow-sm">
                      <Image
                        src={school.logoSrc}
                        alt={school.logoAlt ?? school.name}
                        width={72}
                        height={72}
                        className="h-16 w-16 object-contain"
                      />
                    </div>
                  )}
                  <div className="min-w-0 space-y-2">
                    <h1 className="flex items-center gap-2 text-2xl font-semibold leading-tight">
                      <span className="min-w-0">{displayName}</span>
                      <BadgeCheck
                        className="h-5 w-5 shrink-0 text-[#007AFF]"
                        fill="currentColor"
                        stroke="white"
                        aria-label="Verified partner school"
                      />
                    </h1>
                    <p className="text-sm font-medium">
                      Deadline:{" "}
                      <span
                        className={
                          deadlineExpired ? "text-[#DC2626]" : "text-[#E33F3F]"
                        }
                      >
                        {formatDeadline(school.deadline)}
                        {deadlineExpired && " (Expired)"}
                      </span>
                    </p>
                  </div>
                </div>

                <h1 className="hidden items-center gap-2.5 text-3xl font-semibold leading-tight md:flex md:text-4xl">
                  <span className="min-w-0">{school.name}</span>
                  <BadgeCheck
                    className="h-7 w-7 shrink-0 text-[#007AFF]"
                    fill="currentColor"
                    stroke="white"
                    aria-label="Verified partner school"
                  />
                </h1>

                {aboutParagraphs.length > 0 ? (
                  aboutParagraphs.map((p, index) => <p key={index}>{p}</p>)
                ) : (
                  <p className="text-sm text-[#6B7280]">
                    Details about this university will be added soon.
                  </p>
                )}

                <p className="hidden pt-2 text-sm font-medium md:block md:text-base">
                  Deadline:{" "}
                  <span
                    className={
                      deadlineExpired ? "text-[#DC2626]" : "text-[#E33F3F]"
                    }
                  >
                    {formatDeadline(school.deadline)}
                    {deadlineExpired && " (Expired)"}
                  </span>
                </p>

                <div className="flex flex-wrap gap-3 pt-2 text-sm md:pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCutoffModal(true)}
                    className="flex items-center gap-2 rounded-full bg-[var(--school-brand)] px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[var(--school-brand-hover)]"
                  >
                    <span>See Cut off Points</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/blog?schoolId=${school.id}`)}
                    className="flex items-center gap-2 rounded-full border border-[var(--school-brand)] px-5 py-2 text-sm font-medium text-[var(--school-brand)] hover:bg-[var(--school-brand)] hover:text-white"
                  >
                    <span>University Blog</span>
                  </button>
                </div>
              </>
            )}
          </section>

          <aside className="hidden w-full justify-end md:flex md:w-auto">
            {school?.logoSrc && (
              <Image
                src={school.logoSrc}
                alt={school.logoAlt ?? school.name}
                width={180}
                height={180}
                className="h-40 w-40 object-contain md:h-48 md:w-48"
              />
            )}
          </aside>
        </main>
      </div>

      <section className="mt-10 bg-[#1E1E1E] py-10 text-white md:py-14">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 md:flex-row md:items-center md:justify-between md:px-10">
          {school && deadlineExpired ? (
            <div className="w-full space-y-4 py-8 text-center">
              <h2 className="text-2xl font-semibold leading-snug text-[#FCA5A5] md:text-3xl">
                Application Deadline Passed
              </h2>
              <p className="mx-auto max-w-md text-sm text-gray-400">
                The deadline for this school was {formatDeadline(school.deadline)}.
                Unfortunately, you can no longer purchase a voucher.
              </p>
              <button
                type="button"
                onClick={() => router.push("/university-forms")}
                className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-2.5 text-sm font-medium text-white hover:bg-white/10"
              >
                View Other Schools
              </button>
            </div>
          ) : school && school.requiresVoucher === false ? (
            <>
              <div className="max-w-md space-y-2 text-left">
                <h2 className="text-2xl font-semibold leading-snug md:text-3xl">
                  Ready to apply?
                  <br />
                  Continue to the form
                </h2>
                <p className="text-sm text-gray-400">
                  This school does not require a voucher purchase.
                </p>
              </div>
              <div className="w-full max-w-md space-y-4 text-right">
                <Link
                  href={applyHref}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--school-brand)] px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[var(--school-brand-hover)]"
                >
                  Continue application <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="max-w-md space-y-2 text-left">
                <h2 className="text-2xl font-semibold leading-snug md:text-3xl">
                  Fill this form to
                  <br />
                  purchase your voucher
                </h2>
                {selectedPrice != null && programmeLevel ? (
                  <p className="text-sm text-gray-400">
                    {PROGRAMME_LEVEL_LABELS[programmeLevel]} admission voucher ·
                    GHS {selectedPrice.toFixed(2)}
                  </p>
                ) : school?.voucherPrice != null ||
                  school?.undergraduateVoucherPrice != null ||
                  school?.postgraduateVoucherPrice != null ? (
                  <p className="text-sm text-gray-400">
                    Admission voucher · select a level to see price
                  </p>
                ) : null}
              </div>

              <div className="w-full max-w-md space-y-4">
                <div className="space-y-1 text-sm">
                  <label htmlFor="voucherFullName" className="text-xs font-medium">
                    Full name
                  </label>
                  <input
                    id="voucherFullName"
                    type="text"
                    value={voucherFullName}
                    onChange={(event) => setVoucherFullName(event.target.value)}
                    className="w-full rounded-xl border border-[#E0E0E0] bg-transparent px-4 py-2.5 text-sm text-white outline-none transition focus:border-[var(--school-brand)] focus:ring-1 focus:ring-[var(--school-brand)]"
                  />
                </div>

                <div className="space-y-1 text-sm">
                  <label htmlFor="voucherEmail" className="text-xs font-medium">
                    Email
                  </label>
                  <input
                    id="voucherEmail"
                    type="email"
                    value={voucherEmail}
                    readOnly={Boolean(accountEmail)}
                    onChange={(event) => setVoucherEmail(event.target.value)}
                    className="w-full rounded-xl border border-[#E0E0E0] bg-transparent px-4 py-2.5 text-sm text-white outline-none transition focus:border-[var(--school-brand)] focus:ring-1 focus:ring-[var(--school-brand)] read-only:cursor-default read-only:opacity-80"
                  />
                  {accountEmail ? (
                    <p className="text-[11px] text-gray-400">
                      Linked to your TertiaryGuide account
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-400">
                      Sign in to purchase and save this voucher to your profile
                    </p>
                  )}
                </div>

                <div className="space-y-1 text-sm">
                  <label htmlFor="programmeLevel" className="text-xs font-medium">
                    Programme level
                  </label>
                  <select
                    id="programmeLevel"
                    value={programmeLevel}
                    onChange={(event) =>
                      setProgrammeLevel(event.target.value as ProgrammeLevel | "")
                    }
                    className="w-full rounded-xl border border-[#E0E0E0] bg-[#1E1E1E] px-4 py-2.5 text-sm text-white outline-none transition focus:border-[var(--school-brand)] focus:ring-1 focus:ring-[var(--school-brand)]"
                  >
                    <option value="">Select Undergraduate or Postgraduate</option>
                    <option value="undergraduate">Undergraduate</option>
                    <option value="postgraduate">Postgraduate</option>
                  </select>
                </div>

                {voucherError && (
                  <p className="pt-1 text-xs text-[#FCA5A5]">{voucherError}</p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <Link
                    href={loginHref}
                    className="text-xs text-gray-400 underline-offset-2 hover:text-white hover:underline"
                  >
                    Already have a voucher? Login
                  </Link>
                  <button
                    type="button"
                    onClick={handleBuyVoucher}
                    disabled={!school || loading}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--school-brand)] px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[var(--school-brand-hover)] disabled:opacity-50"
                  >
                    <span>Buy Voucher</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {showSummaryModal && school && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm animate-in zoom-in-95 rounded-2xl bg-white p-6 shadow-2xl duration-200">
            <div className="mb-6 text-center">
              <h3 className="text-lg font-bold text-[#1E1E1E]">Order Summary</h3>
              <p className="text-xs text-gray-500">Please confirm your details</p>
            </div>

            <div className="space-y-4 rounded-xl bg-gray-50 p-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Recipient
                </p>
                <p className="text-sm font-semibold text-[#1E1E1E]">
                  {voucherFullName}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Institution
                </p>
                <p className="truncate text-sm font-semibold text-[#1E1E1E]">
                  {school.name}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Programme level
                </p>
                <p className="text-sm font-semibold text-[#1E1E1E]">
                  {programmeLevel
                    ? PROGRAMME_LEVEL_LABELS[programmeLevel]
                    : "—"}
                </p>
              </div>
              <div className="border-t border-gray-200 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Total Price
                </p>
                <p className="text-xl font-bold text-[var(--school-brand)]">
                  GH₵ {(selectedPrice ?? school.voucherPrice ?? 0).toFixed(2)}
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => void confirmAndPay()}
                disabled={voucherSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--school-brand)] py-3 text-sm font-bold text-white transition hover:bg-[var(--school-brand-hover)] disabled:opacity-50"
              >
                {voucherSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Confirm & Pay <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                disabled={voucherSubmitting}
                className="text-sm font-medium text-gray-500 hover:text-gray-800"
              >
                Back to edit
              </button>
            </div>

            <p className="mt-4 text-center text-[10px] italic text-gray-400">
              Powered by Paystack Secure Payment
            </p>
          </div>
        </div>
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        redirectPath={
          school?.slug
            ? `/apply/school/${encodeURIComponent(school.slug)}`
            : "/apply"
        }
      />

      <Footer />
    </div>
  );
}
