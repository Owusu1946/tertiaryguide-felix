"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Download,
  FileText,
  GraduationCap,
  Loader2,
  Pencil,
} from "lucide-react";
import { ApplicationDocuments } from "@/app/components/ApplicationDocuments";
import { ApplicationLoginModal } from "@/app/components/ApplicationLoginModal";
import {
  downloadApplicationPrintout,
  printoutFromDetail,
} from "@/app/components/ApplicationPrintout";
import { ApplicationStatusCard } from "@/app/components/ApplicationStatusCard";
import { type ApplicationSummaryDetail } from "@/app/components/ApplicationSummary";
import {
  listProgrammeChoices,
  type RankedProgrammeChoice,
} from "@/lib/admissions/programme-choices";
import { canStudentEditApplication } from "@/lib/admissions/edit-window";
import { formatSchoolDeadline } from "@/lib/brand-theme";
import { isDeadlineCalendarExpired } from "@/lib/deadlines";

type Purchase = {
  id: string;
  type: "university_form" | "partner_voucher";
  schoolId?: string;
  schoolName?: string;
  schoolFullName?: string;
  schoolLogo?: string | null;
  schoolSlug?: string | null;
  deadline?: string | null;
  schoolBrandColor?: string | null;
  schoolBrandColors?: string[] | null;
  schoolPhone?: string | null;
  schoolEmail?: string | null;
  schoolAddress?: string | null;
  date: string;
  voucher?: { serial: string; pin: string } | null;
  application?: {
    id: string;
    applicationNumber: string;
    status: string;
    submittedAt?: string | null;
    programmes?: RankedProgrammeChoice[];
    programme?: string | null;
    admittedProgramme?: string | null;
    admittedProgrammeStream?: string | null;
    offerResponse?: "accepted" | "declined" | null;
    detail?: ApplicationSummaryDetail | null;
  } | null;
};

function programmesFor(purchase: Purchase): RankedProgrammeChoice[] {
  if (purchase.application?.programmes?.length) {
    return purchase.application.programmes;
  }
  return listProgrammeChoices(
    purchase.application?.detail?.programmeChoices,
    purchase.application?.programme,
  );
}

function schoolDisplayName(purchase: Purchase) {
  return purchase.schoolFullName || purchase.schoolName || "Partner school";
}

export default function MyApplicationsPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loginPurchase, setLoginPurchase] = useState<Purchase | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [offerBusyId, setOfferBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const email = window.localStorage.getItem("tg_user_email");
    if (!email) {
      router.replace(
        `/signin?redirect=${encodeURIComponent("/dashboard/my-applications")}`,
      );
      return;
    }

    const userEmail = email;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/user/purchases?email=${encodeURIComponent(userEmail)}`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load applications");
        if (cancelled) return;
        const next = ((data.purchases || []) as Purchase[]).filter(
          (p) => p.type === "partner_voucher",
        );
        setPurchases(next);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load applications",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    const onUpdate = () => {
      void load();
    };
    window.addEventListener("tg-purchases-updated", onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("tg-purchases-updated", onUpdate);
    };
  }, [router]);

  const toggleDetails = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const downloadSummary = async (purchase: Purchase) => {
    const application = purchase.application;
    if (!application) return;
    setDownloadingId(purchase.id);
    try {
      await downloadApplicationPrintout({
        school: {
          name: schoolDisplayName(purchase),
          logoSrc: purchase.schoolLogo,
          brandColor: purchase.schoolBrandColor,
          brandColors: purchase.schoolBrandColors,
          phone: purchase.schoolPhone,
          email: purchase.schoolEmail,
          address: purchase.schoolAddress,
        },
        data: printoutFromDetail(
          application.detail || {
            applicationNumber: application.applicationNumber,
            programmes: programmesFor(purchase),
          },
          programmesFor(purchase),
        ),
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const respondToOffer = async (
    purchase: Purchase,
    response: "accepted" | "declined",
  ) => {
    const application = purchase.application;
    const email =
      typeof window !== "undefined"
        ? window.localStorage.getItem("tg_user_email")
        : null;
    if (!application?.id || !email) return;
    setOfferBusyId(purchase.id);
    setError(null);
    try {
      const res = await fetch("/api/apply/offer-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: application.id,
          email,
          response,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save your response");
      setPurchases((prev) =>
        prev.map((item) => {
          if (item.id !== purchase.id || !item.application) return item;
          return {
            ...item,
            application: {
              ...item.application,
              offerResponse: response,
              admittedProgramme:
                data.application?.admittedProgramme ??
                item.application.admittedProgramme,
              admittedProgrammeStream:
                data.application?.admittedProgrammeStream ??
                item.application.admittedProgrammeStream,
              detail: data.application
                ? { ...item.application.detail, ...data.application }
                : item.application.detail,
            },
          };
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your response");
    } finally {
      setOfferBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="h-8 w-8 animate-spin text-[#007AFF]" />
        <p className="text-sm text-[#555555]">Loading your applications…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#1E1E1E] sm:text-3xl">
          My Applications
        </h1>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
          {error}
        </div>
      ) : null}

      {purchases.length === 0 ? (
        <div className="flex flex-col items-center rounded-[28px] border border-[#E8EEF5] bg-white px-5 py-14 text-center sm:px-6 sm:py-16">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF6FF]">
            <GraduationCap className="h-7 w-7 text-[#007AFF]" />
          </span>
          <h2 className="text-lg font-semibold text-[#1E1E1E]">
            No applications yet
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#555555]">
            Direct applications you start from Apply online will appear here.
          </p>
          <Link
            href="/apply"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[#007AFF] px-6 text-sm font-semibold text-white transition hover:bg-[#0062CC] active:scale-[0.98]"
          >
            Apply online
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {purchases.map((purchase) => {
            const deadlineExpired = isDeadlineCalendarExpired(
              purchase.deadline ?? null,
            );
            const canEdit = canStudentEditApplication(
              purchase.application?.status,
              purchase.deadline,
            );
            const expanded = expandedIds.has(purchase.id);
            const downloading = downloadingId === purchase.id;
            const offerBusy = offerBusyId === purchase.id;
            const hasApplication = Boolean(purchase.application);

            return (
              <article
                key={purchase.id}
                className="overflow-hidden rounded-[24px] border border-[#E8EEF5] bg-white shadow-sm sm:rounded-[28px]"
              >
                <div className="px-4 py-4 sm:px-5 sm:py-5">
                  <div className="flex items-start gap-3 sm:gap-4">
                    {purchase.schoolLogo ? (
                      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-[#F8FAFC] ring-1 ring-[#E8EEF5] sm:h-14 sm:w-14">
                        <Image
                          src={purchase.schoolLogo}
                          alt=""
                          fill
                          className="object-contain p-1.5"
                        />
                      </span>
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EEF6FF] text-[#007AFF] sm:h-14 sm:w-14">
                        <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6" />
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            hasApplication
                              ? "bg-[#EFF6FF] text-[#007AFF]"
                              : "bg-[#FFF7ED] text-[#C2410C]"
                          }`}
                        >
                          {hasApplication
                            ? purchase.application?.status || "Submitted"
                            : "Not submitted"}
                        </span>
                      </div>
                      <h2 className="mt-1.5 text-[15px] font-semibold leading-snug text-[#0F172A] sm:text-base">
                        {schoolDisplayName(purchase)}
                      </h2>
                      <p className="mt-1 text-xs leading-relaxed text-[#64748B] sm:text-sm">
                        {purchase.application?.applicationNumber ||
                          "Application not submitted yet"}
                        <span className="mx-1.5 text-[#CBD5E1]">·</span>
                        Deadline {formatSchoolDeadline(purchase.deadline)}
                        {deadlineExpired ? " (closed)" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
                    {hasApplication ? (
                      <button
                        type="button"
                        disabled={downloading}
                        onClick={() => void downloadSummary(purchase)}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#E2E8F0] bg-white px-4 text-sm font-semibold text-[#334155] transition hover:bg-[#F8FAFC] active:scale-[0.98] disabled:opacity-60 sm:w-auto"
                      >
                        {downloading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        {downloading ? "Preparing PDF…" : "Download summary"}
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => toggleDetails(purchase.id)}
                      aria-expanded={expanded}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#E2E8F0] bg-white px-4 text-sm font-semibold text-[#334155] transition hover:bg-[#F8FAFC] active:scale-[0.98] sm:w-auto"
                    >
                      <FileText className="h-4 w-4" />
                      {expanded ? "Hide summary" : "View summary"}
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          expanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => setLoginPurchase(purchase)}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#007AFF] px-4 text-sm font-semibold text-white shadow-sm shadow-[#007AFF]/20 transition hover:bg-[#0062CC] active:scale-[0.98] sm:w-auto"
                      >
                        <Pencil className="h-4 w-4" />
                        {hasApplication
                          ? "Edit application"
                          : "Continue application"}
                      </button>
                    ) : (
                      <p className="text-center text-xs leading-relaxed text-[#64748B] sm:self-center sm:text-left sm:text-sm">
                        {deadlineExpired
                          ? "Editing is closed because the application deadline has passed."
                          : "This application can no longer be edited."}
                      </p>
                    )}
                  </div>
                </div>

                {expanded ? (
                  <div className="space-y-5 border-t border-[#EEF2F7] bg-[#FAFBFC] px-4 py-4 sm:px-5 sm:py-5">
                    {purchase.application ? (
                      <ApplicationStatusCard
                        status={purchase.application.status}
                        schoolName={schoolDisplayName(purchase)}
                        reviewNotes={purchase.application.detail?.reviewNotes}
                        admittedProgramme={
                          purchase.application.admittedProgramme ||
                          purchase.application.detail?.admittedProgramme
                        }
                        admittedProgrammeStream={
                          purchase.application.admittedProgrammeStream ||
                          purchase.application.detail?.admittedProgrammeStream
                        }
                        offerResponse={
                          purchase.application.offerResponse ||
                          purchase.application.detail?.offerResponse
                        }
                        onAcceptOffer={() =>
                          void respondToOffer(purchase, "accepted")
                        }
                        onDeclineOffer={() =>
                          void respondToOffer(purchase, "declined")
                        }
                        offerBusy={offerBusy}
                        compact
                      />
                    ) : (
                      <div className="rounded-[24px] border border-amber-100 bg-gradient-to-br from-[#FFFBEB] to-white p-4 sm:p-5">
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 ring-1 ring-amber-100">
                          Not submitted
                        </span>
                        <h3 className="mt-3 text-base font-semibold text-[#0F172A]">
                          You haven&apos;t submitted this application yet
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-[#475569]">
                          Sign in with your serial number and PIN to fill the
                          form
                          {deadlineExpired
                            ? ". The deadline has passed, so new edits are closed."
                            : " while the deadline is still open."}
                        </p>
                      </div>
                    )}
                    <ApplicationDocuments
                      documents={purchase.application?.detail?.documents}
                      applicationNumber={
                        purchase.application?.applicationNumber
                      }
                    />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {loginPurchase?.schoolId ? (
        <ApplicationLoginModal
          school={{
            id: loginPurchase.schoolId,
            name: schoolDisplayName(loginPurchase),
            alias: loginPurchase.schoolName || null,
            slug: loginPurchase.schoolSlug ?? null,
            logoSrc: loginPurchase.schoolLogo ?? null,
            deadline: loginPurchase.deadline ?? null,
          }}
          initialSerial={loginPurchase.voucher?.serial}
          initialPin={loginPurchase.voucher?.pin}
          onClose={() => setLoginPurchase(null)}
        />
      ) : null}
    </div>
  );
}
