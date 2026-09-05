"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Loader2,
  Search,
} from "lucide-react";
import { Header } from "@/app/components/Header";
import { Footer } from "@/app/components/Footer";
import { ApplicationLoginModal } from "@/app/components/ApplicationLoginModal";
import {
  ApplicationPrintout,
  type ApplicationPrintoutData,
} from "@/app/components/ApplicationPrintout";
import { isDeadlineCalendarExpired } from "@/lib/deadlines";
import { partnerSchoolBuyFormsHref } from "@/lib/school-links";
import { brandThemeStyle } from "@/lib/brand-theme";
import {
  getStoredUserEmail,
  getStoredUserName,
  requireClientAuth,
} from "@/lib/client-auth";
import {
  readApplySession,
  writeApplySession,
} from "@/lib/admissions/applicant-session";
import { controlClass } from "./components/FormControls";
import { MultiStepApplicationForm } from "./components/MultiStepApplicationForm";
import {
  PROGRAMME_LEVEL_LABELS,
  type ProgrammeLevel,
} from "@/lib/admissions/programme-level";

type PartnerSchool = {
  id: string;
  name: string;
  alias: string | null;
  slug: string | null;
  description: string | null;
  logoSrc: string | null;
  logoAlt?: string | null;
  voucherPrice: number | null;
  undergraduateVoucherPrice?: number | null;
  postgraduateVoucherPrice?: number | null;
  requiresVoucher: boolean;
  deadline?: string | null;
  brandColor?: string | null;
  brandColors?: string[] | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

function schoolLabel(school: Pick<PartnerSchool, "name" | "alias">) {
  return school.alias?.trim() || school.name;
}

function formatDeadline(deadline: string | null | undefined): string {
  if (!deadline) return "—";
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return deadline;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type Step =
  | "select"
  | "voucher"
  | "voucher-success"
  | "login"
  | "form"
  | "done";

export default function ApplyPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--school-brand,#007AFF)]" />
        </main>
      }
    >
      <ApplyContent />
    </Suspense>
  );
}

function ApplyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [schools, setSchools] = useState<PartnerSchool[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [school, setSchool] = useState<PartnerSchool | null>(null);
  const [step, setStep] = useState<Step>("select");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Purchase
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [programmeLevel, setProgrammeLevel] = useState<ProgrammeLevel | "">("");

  // Issued voucher
  const [voucherCode, setVoucherCode] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [emailSent, setEmailSent] = useState<boolean | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [submitted, setSubmitted] = useState<{
    applicationNumber: string;
    schoolName: string;
    updated?: boolean;
    printout?: ApplicationPrintoutData;
  } | null>(null);

  const [authReady, setAuthReady] = useState(false);
  const [schoolQuery, setSchoolQuery] = useState("");
  const [loginSchool, setLoginSchool] = useState<PartnerSchool | null>(null);

  useEffect(() => {
    const email = getStoredUserEmail();
    setAuthReady(true);
    if (!email) return;
    setBuyerEmail(email);
    setLoginEmail(email);
    const name = getStoredUserName();
    if (name) setBuyerName(name);
    void fetch(`/api/user/me?email=${encodeURIComponent(email)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.user?.username) setBuyerName(data.user.username);
      })
      .catch(() => undefined);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/apply/schools");
        const data = await res.json();
        if (!cancelled && res.ok) setSchools(data.schools || []);
      } finally {
        if (!cancelled) setLoadingSchools(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Deep-link: ?school=slug&step=...
  useEffect(() => {
    if (loadingSchools || schools.length === 0) return;
    const schoolParam = searchParams.get("school");
    const stepParam = searchParams.get("step") as Step | null;
    const reference = searchParams.get("reference");

    if (schoolParam) {
      const found = schools.find(
        (s) => s.slug === schoolParam || s.id === schoolParam,
      );
      if (found) setSchool(found);
    }

    const codeParam = searchParams.get("voucherCode");
    const serialParam = searchParams.get("serialNumber");
    if (codeParam) setVoucherCode(codeParam.toUpperCase());
    if (serialParam) setSerialNumber(serialParam.toUpperCase());

    // Restore voucher session if URL lost credentials (e.g. refresh on form step)
    if ((!codeParam || !serialParam) && schoolParam) {
      const found = schools.find(
        (s) => s.slug === schoolParam || s.id === schoolParam,
      );
      const saved = readApplySession(found?.id);
      if (saved) {
        if (!codeParam) setVoucherCode(saved.voucherCode);
        if (!serialParam) setSerialNumber(saved.serialNumber);
      }
    }

    if (stepParam && ["select", "voucher", "voucher-success", "login", "form", "done"].includes(stepParam)) {
      setStep(stepParam);
      if (stepParam === "form" || stepParam === "done") {
        setLoginSchool(null);
      }
    }

    if (reference && (stepParam === "voucher-success" || !stepParam)) {
      void (async () => {
        setBusy(true);
        setError(null);
        try {
          const res = await fetch(
            `/api/apply/voucher/verify?reference=${encodeURIComponent(reference)}`,
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Payment verification failed");
          setVoucherCode(data.voucher?.voucherCode || "");
          setSerialNumber(data.voucher?.serialNumber || "");
          if (data.voucher?.voucherCode && data.voucher?.serialNumber) {
            const sid =
              data.school?.id ||
              schools.find((s) => s.slug === data.school?.slug)?.id ||
              "";
            if (sid) {
              writeApplySession({
                schoolId: sid,
                schoolSlug: data.school?.slug,
                voucherCode: data.voucher.voucherCode,
                serialNumber: data.voucher.serialNumber,
              });
            }
          }
          setEmailSent(data.emailSent === true);
          setEmailError(
            data.emailSent ? null : data.emailError || "Could not send email",
          );
          if (typeof data.email === "string" && data.email.trim()) {
            try {
              window.localStorage.setItem(
                "tg_user_email",
                data.email.trim().toLowerCase(),
              );
            } catch {
              // ignore
            }
          }
          router.replace("/dashboard/my-forms");
          return;
        } catch (e) {
          setError(e instanceof Error ? e.message : "Verification failed");
          setStep("voucher");
        } finally {
          setBusy(false);
        }
      })();
    }
  }, [loadingSchools, schools, searchParams]);

  const selectSchool = (s: PartnerSchool) => {
    setError(null);
    setSerialNumber("");
    setVoucherCode("");
    setLoginSchool(s);
  };

  const startPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school || busy) return;
    if (!programmeLevel) {
      setError("Please select Undergraduate or Postgraduate.");
      return;
    }
    const accountEmail = getStoredUserEmail();
    if (!accountEmail) {
      requireClientAuth(router);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/apply/voucher/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: buyerName,
          email: accountEmail,
          schoolId: school.id,
          programmeLevel,
          returnOrigin: window.location.origin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start payment");
      window.location.href = data.authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setBusy(false);
    }
  };

  const validateVoucherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/apply/voucher/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: school.id,
          voucherCode,
          serialNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid voucher");

      const code = String(data.voucher?.voucherCode || voucherCode).trim().toUpperCase();
      const serial = String(
        data.voucher?.serialNumber || serialNumber,
      ).trim().toUpperCase();
      setVoucherCode(code);
      setSerialNumber(serial);
      writeApplySession({
        schoolId: school.id,
        schoolSlug: school.slug,
        voucherCode: code,
        serialNumber: serial,
        email: buyerEmail || undefined,
      });

      setStep("form");
      const params = new URLSearchParams({
        school: school.slug || school.id,
        step: "form",
        voucherCode: code,
        serialNumber: serial,
      });
      router.replace(`/apply?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setBusy(false);
    }
  };

  const continueWithoutVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!school) return;
    setStep("form");
    router.replace(`/apply?school=${school.slug || school.id}&step=form`);
  };

  const stepLabel = useMemo(() => {
    switch (step) {
      case "select":
        return "Select school";
      case "voucher":
        return "Purchase voucher";
      case "voucher-success":
        return "Voucher ready";
      case "login":
        return "Sign in";
      case "form":
        return "Application form";
      case "done":
        return "Submitted";
      default:
        return "";
    }
  }, [step]);

  const filteredSchools = useMemo(() => {
    const q = schoolQuery.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter((s) => {
      const name = s.name.toLowerCase();
      const alias = (s.alias ?? "").toLowerCase();
      return name.includes(q) || alias.includes(q);
    });
  }, [schools, schoolQuery]);

  if (!authReady) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#007AFF]" />
      </main>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#F8FAFC] text-[#050816]"
      style={school ? brandThemeStyle(school.brandColor) : undefined}
    >
      <Header />
      <main
        className={`mx-auto px-4 pt-4 pb-10 sm:px-6 md:pt-6 md:pb-14 ${
          step === "select"
            ? "max-w-6xl md:px-10"
            : "max-w-4xl"
        }`}
      >
        {step !== "select" && (
        <div className="mb-8 flex items-start gap-3">
          {school?.logoSrc ? (
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
              <Image
                src={school.logoSrc}
                alt={school.logoAlt || schoolLabel(school)}
                fill
                className="object-contain p-1.5"
              />
            </div>
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--school-brand,#007AFF)] text-white">
              <GraduationCap className="h-6 w-6" />
            </span>
          )}
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              <span className="min-w-0">{school ? schoolLabel(school) : "Apply for admission"}</span>
              {school && (
                <BadgeCheck
                  className="h-6 w-6 shrink-0 text-[#007AFF]"
                  fill="currentColor"
                  stroke="white"
                  aria-label="Verified partner school"
                />
              )}
            </h1>
            <p className="mt-1 text-sm text-[#6B7280]">
              {school
                ? `${stepLabel}${school.alias && school.alias !== school.name ? ` · ${school.name}` : ""}`
                : stepLabel}
            </p>
          </div>
        </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {step === "select" && (
          <section className="space-y-6 md:space-y-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-8">
              <div className="min-w-0 max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#007AFF]">
                  Apply online
                </p>
                <h1 className="mt-1 text-[1.65rem] font-bold leading-tight tracking-tight text-[#0F172A] sm:text-3xl md:text-4xl">
                  Apply to a Partner School
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-[#64748B] sm:text-[15px] md:text-base">
                  Select the school you wish to apply to and complete your
                  admission application in a few simple steps.
                </p>
              </div>

              <label className="relative block w-full shrink-0 md:max-w-sm">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
                  aria-hidden
                />
                <input
                  type="search"
                  value={schoolQuery}
                  onChange={(e) => setSchoolQuery(e.target.value)}
                  placeholder="Search schools..."
                  className="w-full rounded-full border border-[#E2E8F0] bg-white py-3 pl-10 pr-4 text-sm text-[#111827] shadow-sm outline-none placeholder:text-[#94A3B8] focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20"
                  aria-label="Search schools"
                />
              </label>
            </div>

            {loadingSchools ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-[#007AFF]" />
              </div>
            ) : schools.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#D1D5DB] bg-white px-6 py-16 text-center text-sm text-[#6B7280]">
                No institutions are accepting applications yet.
              </div>
            ) : filteredSchools.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#D1D5DB] bg-white px-6 py-16 text-center text-sm text-[#6B7280]">
                No schools match “{schoolQuery.trim()}”.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredSchools.map((s) => {
                  const expired = isDeadlineCalendarExpired(s.deadline ?? null);
                  const shortName = schoolLabel(s);
                  const showFullName =
                    Boolean(s.alias?.trim()) && s.alias?.trim() !== s.name;
                  return (
                    <article
                      key={s.id}
                      className="flex flex-col rounded-3xl border border-[#E8EEF5] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-[#BFDBFE] hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)] sm:p-5 md:p-6"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3 md:gap-4">
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-[#F8FAFC] ring-1 ring-[#EEF2F7] md:h-[4.5rem] md:w-[4.5rem]">
                          {s.logoSrc ? (
                            <Image
                              src={s.logoSrc}
                              alt={s.logoAlt || schoolLabel(s)}
                              fill
                              className="object-contain p-1.5"
                              sizes="72px"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-[#007AFF]">
                              <GraduationCap className="h-6 w-6" />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className="flex items-center gap-1.5 text-base font-semibold text-[#0F172A] md:text-lg">
                            <span className="min-w-0 truncate">{shortName}</span>
                            <BadgeCheck
                              className="h-4 w-4 shrink-0 text-[#007AFF] md:h-[18px] md:w-[18px]"
                              fill="currentColor"
                              stroke="white"
                              aria-label="Verified partner school"
                            />
                          </p>
                          {showFullName && (
                            <p className="mt-0.5 hidden truncate text-sm text-[#64748B] md:block">
                              {s.name}
                            </p>
                          )}
                          <p
                            className={`mt-2 inline-flex items-center gap-1.5 text-sm ${
                              expired ? "text-red-600" : "text-[#64748B]"
                            }`}
                          >
                            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              Deadline:{" "}
                              {expired ? "Expired" : formatDeadline(s.deadline)}
                            </span>
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => selectSchool(s)}
                        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#007AFF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0066D6] active:scale-[0.99] md:mt-5"
                      >
                        Start Application
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {step === "voucher" && school && (
          <section className="rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <button
              type="button"
              onClick={() => {
                setStep("select");
                setSchool(null);
                router.replace("/apply");
              }}
              className="mb-4 inline-flex items-center gap-1 text-sm text-[#6B7280]"
            >
              <ChevronLeft className="h-4 w-4" /> Change school
            </button>
            <h2 className="text-lg font-semibold">Purchase admission voucher</h2>
            <p className="mt-1 text-sm text-[#6B7280]">
              {schoolLabel(school)}
              {programmeLevel
                ? ` · ${PROGRAMME_LEVEL_LABELS[programmeLevel]} · GHS ${
                    (programmeLevel === "postgraduate"
                      ? school.postgraduateVoucherPrice
                      : school.undergraduateVoucherPrice) ??
                    school.voucherPrice ??
                    "—"
                  }`
                : ` · select a level to see price`}
            </p>
            <form onSubmit={startPayment} className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-medium">Full name</span>
                <input
                  required
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className={controlClass}
                />
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-medium">Email</span>
                <input
                  required
                  type="email"
                  value={buyerEmail}
                  readOnly
                  className={`${controlClass} bg-[#F8FAFC] text-[#64748B]`}
                />
                <span className="text-xs text-[#6B7280]">
                  Voucher will be linked to your TertiaryGuide account.
                </span>
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-medium">Programme level</span>
                <select
                  required
                  value={programmeLevel}
                  onChange={(e) =>
                    setProgrammeLevel(e.target.value as ProgrammeLevel | "")
                  }
                  className={controlClass}
                >
                  <option value="">Select Undergraduate or Postgraduate</option>
                  <option value="undergraduate">Undergraduate</option>
                  <option value="postgraduate">Postgraduate</option>
                </select>
              </label>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--school-brand,#007AFF)] px-5 py-2.5 text-sm font-semibold text-white sm:col-span-2 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Pay with Paystack
              </button>
            </form>
            <p className="mt-4 text-center text-xs text-[#9CA3AF]">
              Already have a voucher?{" "}
              <button
                type="button"
                className="text-[var(--school-brand,#007AFF)] underline"
                onClick={() => setStep("login")}
              >
                Login with voucher
              </button>
            </p>
          </section>
        )}

        {step === "voucher-success" && (
          <section className="rounded-3xl border border-green-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Payment successful</h2>
            </div>
            <p className="mt-2 text-sm text-[#6B7280]">
              Your voucher has been generated. Save these details and continue to the form.
            </p>
            {emailSent === true && (
              <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">
                Voucher code and serial were also sent to your email.
              </p>
            )}
            {emailSent === false && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                We could not send the email{emailError ? `: ${emailError}` : ""}.
                Please save the code and serial below.
              </p>
            )}
            <div className="mt-4 rounded-2xl bg-[#F3F4F6] p-4 font-mono text-sm text-[#111827]">
              <p>
                <strong>Serial Number:</strong> {serialNumber}
              </p>
              <p className="mt-2">
                <strong>PIN:</strong> {voucherCode}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep("login")}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--school-brand,#007AFF)] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Continue to login <ChevronRight className="h-4 w-4" />
            </button>
            <p className="mt-4 text-sm text-[#6B7280]">
              These details are also saved in your{" "}
              <Link
                href="/dashboard/my-forms"
                className="text-[var(--school-brand,#007AFF)] underline"
              >
                profile → My Forms
              </Link>
              . You can return anytime at{" "}
              <Link href="/apply/portal" className="text-[var(--school-brand,#007AFF)] underline">
                /apply/portal
              </Link>{" "}
              with the same voucher credentials.
            </p>
          </section>
        )}

        {step === "login" && school && (
          <section className="overflow-hidden rounded-[28px] border border-[#E8EEF5] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            <div className="border-b border-[#EEF2F7] bg-gradient-to-br from-[var(--school-brand-soft,#EFF6FF)] via-white to-white px-5 py-5 sm:px-6">
            <h2 className="text-lg font-semibold tracking-tight text-[#0F172A]">
              {school.requiresVoucher ? "Login with voucher" : "Continue application"}
            </h2>
            <p className="mt-1 text-sm text-[#64748B]">
              {school.requiresVoucher
                ? "Use the serial number and PIN from your payment email or My Forms."
                : "Sign in with your details to continue your application."}
            </p>
            </div>
            <div className="px-5 py-6 sm:px-6">
            {school.requiresVoucher ? (
              <form onSubmit={validateVoucherLogin} className="grid gap-4">
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-[#334155]">Serial number</span>
                  <input
                    required
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 font-mono text-[#111827] caret-[#111827] outline-none placeholder:text-[#9CA3AF] focus:border-[var(--school-brand,#007AFF)]"
                    placeholder="TG-2026-001234"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">PIN</span>
                  <input
                    required
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 font-mono text-[#111827] caret-[#111827] outline-none placeholder:text-[#9CA3AF] focus:border-[var(--school-brand,#007AFF)]"
                    placeholder="HS-8K7D-29PX"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-full bg-[var(--school-brand,#007AFF)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busy ? "Validating…" : "Continue"}
                </button>
                <p className="text-center text-sm text-[#6B7280]">
                  Don’t have a form yet?
                </p>
                <Link
                  href={partnerSchoolBuyFormsHref(school)}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--school-brand,#007AFF)] px-5 py-2.5 text-center text-sm font-semibold text-[var(--school-brand,#007AFF)]"
                >
                  Buy new forms
                </Link>
              </form>
            ) : (
              <form onSubmit={continueWithoutVoucher} className="mt-6 grid gap-4">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Email</span>
                  <input
                    required
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className={controlClass}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Password (optional if new)</span>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className={controlClass}
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-full bg-[var(--school-brand,#007AFF)] px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Continue to form
                </button>
              </form>
            )}
            </div>
          </section>
        )}

        {step === "form" && school && (
          <MultiStepApplicationForm
            schoolId={school.id}
            schoolName={school.name}
            schoolSlug={school.slug}
            schoolLogo={school.logoSrc}
            brandColor={school.brandColor}
            brandColors={school.brandColors}
            schoolPhone={school.phone}
            schoolEmail={school.email}
            schoolAddress={school.address}
            voucherCode={voucherCode || undefined}
            serialNumber={serialNumber || undefined}
            loginEmail={!school.requiresVoucher ? loginEmail : undefined}
            loginPassword={!school.requiresVoucher ? loginPassword : undefined}
            initialEmail={buyerEmail || loginEmail || undefined}
            onSubmitted={(result) => {
              setSubmitted({
                applicationNumber: result.applicationNumber,
                schoolName: result.schoolName,
                updated: result.updated,
                printout: result.printout,
              });
              setStep("done");
            }}
          />
        )}

        {step === "done" && submitted && (
          <section className="space-y-6">
            <div className="rounded-3xl border border-green-200 bg-white p-8 text-center shadow-sm">
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
              <h2 className="mt-4 text-xl font-semibold">
                {submitted.updated
                  ? "Application updated"
                  : "Application submitted"}
              </h2>
              <p className="mt-2 text-sm text-[#6B7280]">
                Your application to{" "}
                {school ? schoolLabel(school) : submitted.schoolName} has been
                {submitted.updated ? " saved." : " received."}
              </p>
              <p className="mt-2 text-sm text-[#6B7280]">
                You can still buy a form for another school.
              </p>
              <p className="mt-4 font-mono text-lg font-semibold text-[var(--school-brand,#007AFF)]">
                {submitted.applicationNumber}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  href="/university-forms"
                  className="inline-flex rounded-full bg-[var(--school-brand,#007AFF)] px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Buy another form
                </Link>
                <Link
                  href="/dashboard/my-applications"
                  className="inline-flex rounded-full border border-[#E5E7EB] px-5 py-2.5 text-sm font-semibold"
                >
                  My Applications
                </Link>
              </div>
            </div>
            {submitted.printout && school ? (
              <ApplicationPrintout
                school={{
                  name: school.name,
                  logoSrc: school.logoSrc,
                  brandColor: school.brandColor,
                  brandColors: school.brandColors,
                  phone: school.phone,
                  email: school.email,
                  address: school.address,
                }}
                data={submitted.printout}
              />
            ) : null}
          </section>
        )}
      </main>
      <Footer />
      {loginSchool && (
        <ApplicationLoginModal
          school={loginSchool}
          onClose={() => setLoginSchool(null)}
        />
      )}
    </div>
  );
}
