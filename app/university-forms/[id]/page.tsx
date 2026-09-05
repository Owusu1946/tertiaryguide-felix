"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowRight } from "lucide-react";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { AuthModal } from "../../components/AuthModal";
import { CutoffModal } from "../../components/CutoffModal";
import { isDeadlineCalendarExpired } from "@/lib/deadlines";
import { catalogSchoolHref } from "@/lib/school-links";
import {
  PROGRAMME_LEVEL_LABELS,
  type ProgrammeLevel,
} from "@/lib/admissions/programme-level";

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

type SchoolDetail = {
  id: string;
  name: string;
  alias: string | null;
  slug?: string | null;
  logoSrc: string | null;
  logoAlt: string | null;
  priceGhs: number | null;
  undergraduateVoucherPrice?: number | null;
  postgraduateVoucherPrice?: number | null;
  voucherPrice?: number | null;
  deadline: string | null;
  about: string | null;
  isPartner?: boolean;
};

export default function SchoolDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const schoolId = params?.id;

  const [school, setSchool] = useState<SchoolDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voucherFullName, setVoucherFullName] = useState("");
  const [voucherEmail, setVoucherEmail] = useState("");
  const [programmeLevel, setProgrammeLevel] = useState<ProgrammeLevel | "">("");
  const [voucherSubmitting, setVoucherSubmitting] = useState(false);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCutoffModal, setShowCutoffModal] = useState(false);
  
  // NEW: State for the confirmation modal
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/schools/${schoolId}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load school");
        }
        if (!cancelled) {
          const loaded = data.school ?? null;
          if (loaded?.isPartner) {
            router.replace(catalogSchoolHref(loaded));
            return;
          }
          setSchool(loaded);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[SchoolDetails] load error", err);
          setError("Could not load school details. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    const email = window.localStorage.getItem("tg_user_email");
    if (email) {
      setVoucherEmail(email);
      fetch(`/api/user/profile?email=${encodeURIComponent(email)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.user?.username) {
            setVoucherFullName(data.user.username);
          }
        })
        .catch(() => { });
    }

    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  const aboutParagraphs = (school?.about ?? "").split(/\n\n+/).filter((p) => p.trim().length > 0);
  const schoolDisplayName = school?.alias?.trim() || school?.name || "";

  const selectedPrice = (() => {
    if (!school || !programmeLevel) return null;
    if (programmeLevel === "postgraduate") {
      return (
        school.postgraduateVoucherPrice ??
        school.voucherPrice ??
        school.priceGhs ??
        null
      );
    }
    return (
      school.undergraduateVoucherPrice ??
      school.voucherPrice ??
      school.priceGhs ??
      null
    );
  })();

  // STEP 1: VALIDATE AND SHOW SUMMARY
  async function handleBuyVoucher() {
    if (!schoolId) return;

    const email = window.localStorage.getItem("tg_user_email");
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
    setShowSummaryModal(true); // Open the summary instead of paying immediately
  }

  // STEP 2: ACTUAL PAYMENT EXECUTION
  async function confirmAndPay() {
    if (!programmeLevel) return;
    try {
      setVoucherSubmitting(true);
      setVoucherError(null);

      const res = await fetch("/api/payments/forms/init", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: voucherFullName.trim(),
          email: voucherEmail.trim(),
          schoolId,
          programmeLevel,
          returnOrigin:
            typeof window !== "undefined" ? window.location.origin : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setVoucherError(data.error || "Could not start payment. Please try again.");
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

  return (
    <div className="min-h-screen bg-white text-[#1E1E1E]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pb-8 sm:px-6 md:gap-5 md:px-10 md:pb-10">
        <Header />

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          redirectPath={`/university-forms/${schoolId}`}
        />

        {school && (
          <CutoffModal
            isOpen={showCutoffModal}
            onClose={() => setShowCutoffModal(false)}
            schoolName={school.name}
            schoolId={schoolId ?? ""}
            source="catalog"
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
                <h1 className="text-2xl font-semibold text-[#B91C1C]">Something went wrong</h1>
                <p className="text-sm text-[#6B7280]">{error}</p>
              </>
            ) : !school ? (
              <>
                <h1 className="text-2xl font-semibold">School not found</h1>
                <p className="text-sm text-[#6B7280]">The form you are looking for does not exist.</p>
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
                    <h1 className="text-2xl font-semibold leading-tight">
                      {schoolDisplayName}
                    </h1>
                    <p className="text-sm font-medium">
                      Deadline:{" "}
                      <span
                        className={
                          isDeadlineCalendarExpired(school.deadline)
                            ? "text-[#DC2626]"
                            : "text-[#E33F3F]"
                        }
                      >
                        {formatDeadline(school.deadline)}
                      </span>
                    </p>
                  </div>
                </div>

                <h1 className="hidden text-3xl font-semibold leading-tight md:block md:text-4xl">
                  {school.name}
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
                  <span className={isDeadlineCalendarExpired(school.deadline) ? "text-[#DC2626]" : "text-[#E33F3F]"}>
                    {formatDeadline(school.deadline)}
                  </span>
                </p>

                <div className="flex flex-wrap gap-3 pt-2 text-sm md:pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCutoffModal(true)}
                    className="flex items-center gap-2 rounded-full bg-[#007AFF] px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#0062CC]"
                  >
                    <span>See Cut off Points</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/blog?schoolId=${school.id}`)}
                    className="flex items-center gap-2 rounded-full border border-[#007AFF] px-5 py-2 text-sm font-medium text-[#007AFF] hover:bg-[#007AFF] hover:text-white"
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
          {school && isDeadlineCalendarExpired(school.deadline) ? (
            <div className="w-full text-center space-y-4 py-8">
              <h2 className="text-2xl font-semibold leading-snug md:text-3xl text-[#FCA5A5]">
                Application Deadline Passed
              </h2>
              <p className="text-sm text-gray-400 max-w-md mx-auto">
                The deadline for purchasing this form was {formatDeadline(school.deadline)}.
                Unfortunately, you can no longer purchase this voucher.
              </p>
              <button
                type="button"
                onClick={() => router.push("/university-forms")}
                className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-2.5 text-sm font-medium text-white hover:bg-white/10"
              >
                View Other Forms
              </button>
            </div>
          ) : (
            <>
              <div className="max-w-md space-y-2 text-left">
                <h2 className="text-2xl font-semibold leading-snug md:text-3xl">
                  Fill this form to
                  <br />
                  purchase your voucher
                </h2>
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
                    className="w-full rounded-xl border border-[#E0E0E0] bg-transparent px-4 py-2.5 text-sm text-white outline-none transition focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
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
                    onChange={(event) => setVoucherEmail(event.target.value)}
                    className="w-full rounded-xl border border-[#E0E0E0] bg-transparent px-4 py-2.5 text-sm text-white outline-none transition focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                  />
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
                    className="w-full rounded-xl border border-[#E0E0E0] bg-[#1E1E1E] px-4 py-2.5 text-sm text-white outline-none transition focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                  >
                    <option value="">Select Undergraduate or Postgraduate</option>
                    <option value="undergraduate">Undergraduate</option>
                    <option value="postgraduate">Postgraduate</option>
                  </select>
                </div>

                {voucherError && (
                  <p className="pt-1 text-xs text-[#FCA5A5]">{voucherError}</p>
                )}

                <div className="pt-2 text-right">
                  <button
                    type="button"
                    onClick={handleBuyVoucher}
                    className="inline-flex items-center gap-2 rounded-full bg-[#007AFF] px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#0062CC]"
                  >
                    <span>Buy Voucher</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* NEW: SUMMARY MODAL IMPLEMENTATION */}
      {showSummaryModal && school && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mb-6 text-center">
              <h3 className="text-lg font-bold text-[#1E1E1E]">Order Summary</h3>
              <p className="text-xs text-gray-500">Please confirm your details</p>
            </div>

            <div className="space-y-4 rounded-xl bg-gray-50 p-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Recipient</p>
                <p className="text-sm font-semibold text-[#1E1E1E]">{voucherFullName}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Institution</p>
                <p className="text-sm font-semibold text-[#1E1E1E] truncate">{school.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Programme level</p>
                <p className="text-sm font-semibold text-[#1E1E1E]">
                  {programmeLevel ? PROGRAMME_LEVEL_LABELS[programmeLevel] : "—"}
                </p>
              </div>
              <div className="border-t border-gray-200 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Price</p>
                <p className="text-xl font-bold text-[#007AFF]">
                  GH₵ {(selectedPrice ?? school.priceGhs ?? 0).toFixed(2)}
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <button
                onClick={confirmAndPay}
                disabled={voucherSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#007AFF] py-3 text-sm font-bold text-white transition hover:bg-[#0062CC] disabled:opacity-50"
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
                onClick={() => setShowSummaryModal(false)}
                disabled={voucherSubmitting}
                className="text-sm font-medium text-gray-500 hover:text-gray-800"
              >
                Back to edit
              </button>
            </div>
            
            <p className="mt-4 text-center text-[10px] text-gray-400 italic">
              Powered by Paystack Secure Payment
            </p>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
