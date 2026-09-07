"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  GraduationCap,
  Loader2,
  LogOut,
  Pencil,
} from "lucide-react";
import { ApplicationDocuments } from "@/app/components/ApplicationDocuments";
import { ApplicationStatusCard } from "@/app/components/ApplicationStatusCard";
import { ProgrammeChoicesList } from "@/app/components/ProgrammeChoicesList";
import { Header } from "@/app/components/Header";
import { Footer } from "@/app/components/Footer";
import { brandThemeStyle } from "@/lib/brand-theme";
import { requireClientAuth } from "@/lib/client-auth";
import { partnerSchoolBuyFormsHref } from "@/lib/school-links";
import {
  listProgrammeChoices,
  type RankedProgrammeChoice,
} from "@/lib/admissions/programme-choices";

const SESSION_KEY = "tg_applicant_session";

type PartnerSchool = {
  id: string;
  name: string;
  alias: string | null;
  slug: string | null;
  logoSrc: string | null;
  requiresVoucher: boolean;
  brandColor?: string | null;
};

type ApplicationDetail = {
  id: string;
  applicationNumber: string;
  fullName: string;
  email: string;
  phone: string | null;
  programme: string | null;
  programmes?: RankedProgrammeChoice[];
  status: string;
  submittedAt: string;
  updatedAt: string;
  personalInfo?: Record<string, string | undefined>;
  guardianInfo?: Record<string, string | undefined> | null;
  programmeChoices?: Record<string, string | undefined> | null;
  educationalBackground?: Record<string, string | undefined>[];
  examinationInfo?: Record<string, string | undefined> | null;
  additionalExaminations?: Record<string, string | undefined>[] | null;
  examinationSittings?: Array<
    Record<string, string | undefined> & {
      results?: { subject: string; grade: string }[];
    }
  > | null;
  results?: { subject: string; grade: string }[];
  documents?: Record<string, string | undefined> | null;
  reviewNotes?: string | null;
};

type Session = {
  schoolId: string;
  schoolName: string;
  schoolSlug: string | null;
  brandColor?: string | null;
  voucherCode: string;
  serialNumber: string;
  application: ApplicationDetail | null;
  canEdit: boolean;
};

export default function ApplicantPortalPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#007AFF]" />
        </main>
      }
    >
      <ApplicantPortalContent />
    </Suspense>
  );
}

function ApplicantPortalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [schools, setSchools] = useState<PartnerSchool[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const email = requireClientAuth(router);
    if (!email) return;
    setAuthReady(true);
  }, [router]);

  useEffect(() => {
    if (!authReady) return;

    void fetch("/api/apply/schools")
      .then((r) => r.json())
      .then((data) => {
        if (data.schools) setSchools(data.schools);
      })
      .catch(() => undefined);

    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Session;
        if (saved?.voucherCode && saved?.schoolId) {
          setSession(saved);
          setSchoolId(saved.schoolId);
          setVoucherCode(saved.voucherCode);
          setSerialNumber(saved.serialNumber);
        }
      }
    } catch {
      // ignore
    }

    const code = searchParams.get("voucherCode");
    const serial = searchParams.get("serialNumber");
    const sid = searchParams.get("schoolId");
    if (code) setVoucherCode(code.toUpperCase());
    if (serial) setSerialNumber(serial.toUpperCase());
    if (sid) setSchoolId(sid);
  }, [authReady, searchParams]);

  const persistSession = (next: Session) => {
    setSession(next);
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  };

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Session;
      if (!saved?.voucherCode || !saved.schoolId) return;
      void (async () => {
        const res = await fetch("/api/apply/voucher/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolId: saved.schoolId,
            voucherCode: saved.voucherCode,
            serialNumber: saved.serialNumber,
          }),
        });
        const data = await res.json();
        if (cancelled || !res.ok) return;
        const next: Session = {
          schoolId: data.school.id,
          schoolName: data.school.name,
          schoolSlug: data.school.slug,
          brandColor: data.school.brandColor ?? saved.brandColor,
          voucherCode: data.voucher.voucherCode,
          serialNumber: data.voucher.serialNumber,
          application: data.application,
          canEdit: data.canEdit !== false,
        };
        persistSession(next);
      })();
    } catch {
      // ignore
    }
    return () => {
      cancelled = true;
    };
  }, [authReady]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/apply/voucher/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, voucherCode, serialNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      const next: Session = {
        schoolId: data.school.id,
        schoolName: data.school.name,
        schoolSlug: data.school.slug,
        brandColor: data.school.brandColor ?? null,
        voucherCode: data.voucher.voucherCode,
        serialNumber: data.voucher.serialNumber,
        application: data.application,
        canEdit: data.canEdit !== false,
      };
      persistSession(next);
      if (!data.application) {
        setMessage("Voucher verified. You have not submitted an application yet.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setMessage(null);
  };

  const activeSchool =
    schools.find((s) => s.id === (session?.schoolId || schoolId)) || null;
  const themeStyle = brandThemeStyle(
    session?.brandColor || activeSchool?.brandColor,
  );
  const chosenProgrammes = session?.application
    ? session.application.programmes?.length
      ? session.application.programmes
      : listProgrammeChoices(
          session.application.programmeChoices,
          session.application.programme,
        )
    : [];

  if (!authReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F9FC]">
        <Loader2 className="h-6 w-6 animate-spin text-[#007AFF]" />
      </main>
    );
  }

  return (
    <div
      className="min-h-screen bg-[linear-gradient(135deg,#F8FAFC_0%,#EFF6FF_48%,#F8FAFC_100%)] text-[#0F172A]"
      style={themeStyle}
    >
      <Header />
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-12 sm:px-6 md:pt-8">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--school-brand,#007AFF)]">
              Student portal
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
              My application
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#64748B]">
              Check status, review your chosen programmes, and edit while the
              school is still reviewing.
            </p>
          </div>
          {session ? (
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out of the student portal"
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-[#E2E8F0] bg-white/90 px-4 py-2 text-xs font-semibold text-[#334155] shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-[#CBD5E1] hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--school-brand,#007AFF)] focus-visible:ring-offset-2 sm:self-center"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Log out
            </button>
          ) : null}
        </header>

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </div>
        ) : null}

        {!session ? (
          <section className="overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <div className="bg-gradient-to-br from-[#EFF6FF] to-white px-6 py-5">
              <h2 className="text-lg font-semibold">Student voucher login</h2>
              <p className="mt-1 text-sm text-[#6B7280]">
                Use the same serial number and PIN from your payment email.
              </p>
            </div>
            <form onSubmit={handleLogin} className="grid gap-4 px-6 py-6 sm:grid-cols-2">
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-medium">School</span>
                <select
                  required
                  value={schoolId}
                  onChange={(e) => setSchoolId(e.target.value)}
                  className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 outline-none focus:border-[var(--school-brand,#007AFF)]"
                >
                  <option value="">Select school</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.alias?.trim() || s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-[#334155]">Serial number</span>
                <input
                  required
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 font-mono text-[#111827] caret-[#111827] outline-none placeholder:text-[#9CA3AF] focus:border-[var(--school-brand,#007AFF)]"
                  placeholder="TG-2026-001234"
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-[#334155]">PIN</span>
                <input
                  required
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 font-mono text-[#111827] caret-[#111827] outline-none placeholder:text-[#9CA3AF] focus:border-[var(--school-brand,#007AFF)]"
                  placeholder="HS-8K7D-29PX"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-[var(--school-brand,#007AFF)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--school-brand-hover,#0062CC)] disabled:opacity-60 sm:col-span-2"
              >
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in…
                  </span>
                ) : (
                  "Continue"
                )}
              </button>
            </form>
            <p className="border-t border-[#F1F5F9] px-6 py-4 text-center text-sm text-[#6B7280]">
              Don’t have a form yet?{" "}
              {activeSchool ? (
                <Link
                  href={partnerSchoolBuyFormsHref(activeSchool)}
                  className="font-semibold text-[var(--school-brand,#007AFF)] underline"
                >
                  Buy new forms
                </Link>
              ) : (
                <Link
                  href="/apply"
                  className="font-semibold text-[var(--school-brand,#007AFF)] underline"
                >
                  Choose a school
                </Link>
              )}
            </p>
          </section>
        ) : (
          <div className="space-y-6">
            <section className="overflow-hidden rounded-[32px] border border-white/80 bg-white/95 shadow-[0_20px_55px_rgba(15,23,42,0.09)] backdrop-blur">
              <div className="relative overflow-hidden bg-gradient-to-br from-[var(--school-brand-soft,#DBEAFE)] via-white to-white px-6 py-7 sm:px-8">
                <div className="absolute inset-y-0 left-0 w-1 bg-[var(--school-brand,#007AFF)]" />
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#64748B]">
                  {session.schoolName}
                </p>
                {session.application ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold tracking-[-0.025em]">
                      {session.application.fullName}
                    </h2>
                  </div>
                ) : (
                  <h2 className="mt-1 text-xl font-semibold">Application not submitted</h2>
                )}
              </div>
              {session.application ? (
                <div className="space-y-7 px-6 py-6 sm:px-8 sm:py-8">
                  <ApplicationStatusCard
                    status={session.application.status}
                    schoolName={session.schoolName}
                    reviewNotes={session.application.reviewNotes}
                  />

                  <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-[#EEF2F7] bg-[#F8FAFC] px-4 py-3.5">
                      <dt className="text-xs font-medium uppercase tracking-wide text-[#94A3B8]">
                        Application number
                      </dt>
                      <dd className="mt-1 truncate font-mono text-sm font-semibold">
                        {session.application.applicationNumber}
                      </dd>
                    </div>
                    <div className="rounded-2xl border border-[#EEF2F7] bg-[#F8FAFC] px-4 py-3.5">
                      <dt className="text-xs font-medium uppercase tracking-wide text-[#94A3B8]">
                        Submitted
                      </dt>
                      <dd className="mt-1 text-sm font-medium">
                        {new Date(session.application.submittedAt).toLocaleString()}
                      </dd>
                    </div>
                    <div className="rounded-2xl border border-[#EEF2F7] bg-[#F8FAFC] px-4 py-3.5">
                      <dt className="text-xs font-medium uppercase tracking-wide text-[#94A3B8]">
                        Last updated
                      </dt>
                      <dd className="mt-1 text-sm font-medium">
                        {new Date(session.application.updatedAt).toLocaleString()}
                      </dd>
                    </div>
                  </dl>

                  <div className="rounded-[26px] border border-[#DCEBFA] bg-[linear-gradient(145deg,#F8FBFF,#F1F7FF)] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-[var(--school-brand,#007AFF)]" />
                      <h3 className="text-sm font-bold text-[#0F172A]">
                        Chosen programmes
                      </h3>
                    </div>
                    <ProgrammeChoicesList
                      programmes={chosenProgrammes}
                      columns={4}
                      emptyLabel="No programme choices on this application yet."
                    />
                  </div>

                  <ApplicationDocuments
                    documents={session.application.documents}
                    applicationNumber={session.application.applicationNumber}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {session.canEdit && (
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/apply?school=${session.schoolSlug || session.schoolId}&step=form&voucherCode=${encodeURIComponent(session.voucherCode)}&serialNumber=${encodeURIComponent(session.serialNumber)}`,
                          )
                        }
                        className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--school-brand,#007AFF)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--school-brand-hover,#0062CC)]"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit application
                      </button>
                    )}
                    {!session.canEdit && (
                      <p className="self-center text-sm text-[#6B7280]">
                        This application is no longer open for edits.
                      </p>
                    )}
                    <Link
                      href="/dashboard/my-forms"
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-[#D7E0EA] bg-white px-4 py-2.5 text-sm font-semibold text-[#334155] shadow-sm transition hover:-translate-y-0.5 hover:border-[#B9C7D8] hover:bg-[#F8FAFC] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--school-brand,#007AFF)] focus-visible:ring-offset-2"
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                      Back to My Forms
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="px-6 py-6">
                  <div className="flex items-center gap-2 text-amber-700">
                    <CheckCircle2 className="h-5 w-5" />
                    <p className="font-medium">No application submitted yet</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/apply?school=${session.schoolSlug || session.schoolId}&step=form&voucherCode=${encodeURIComponent(session.voucherCode)}&serialNumber=${encodeURIComponent(session.serialNumber)}`,
                        )
                      }
                      className="rounded-full bg-[var(--school-brand,#007AFF)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--school-brand-hover,#0062CC)]"
                    >
                      Complete application form
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
