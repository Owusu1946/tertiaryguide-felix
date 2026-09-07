"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Download, GraduationCap, Loader2, Pencil } from "lucide-react";
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

export default function MyApplicationsPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [offerBusy, setOfferBusy] = useState(false);

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
        setSelectedId((current) => {
          if (current && next.some((item) => item.id === current)) return current;
          return next[0]?.id ?? null;
        });
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

  const selected = useMemo(
    () => purchases.find((item) => item.id === selectedId) || null,
    [purchases, selectedId],
  );

  const respondToOffer = async (response: "accepted" | "declined") => {
    const application = selected?.application;
    const email =
      typeof window !== "undefined"
        ? window.localStorage.getItem("tg_user_email")
        : null;
    if (!application?.id || !email) return;
    setOfferBusy(true);
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
          if (item.id !== selected?.id || !item.application) return item;
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
      setOfferBusy(false);
    }
  };

  const deadlineExpired = selected
    ? isDeadlineCalendarExpired(selected.deadline ?? null)
    : false;
  const canEdit = selected
    ? canStudentEditApplication(
        selected.application?.status,
        selected.deadline,
      )
    : false;

  if (loading) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="h-8 w-8 animate-spin text-[#007AFF]" />
        <p className="text-sm text-[#555555]">Loading your applications…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#1E1E1E] sm:text-3xl">
          My Applications
        </h1>
        <p className="mt-1 text-sm text-[#555555]">
          Open a school tab to download the official printout as a PDF, or sign
          in to edit while the deadline is still open.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
          {error}
        </div>
      ) : null}

      {purchases.length === 0 ? (
        <div className="flex flex-col items-center rounded-[28px] border border-[#E8EEF5] bg-white px-6 py-16 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF6FF]">
            <GraduationCap className="h-7 w-7 text-[#007AFF]" />
          </span>
          <h2 className="text-lg font-semibold text-[#1E1E1E]">
            No applications yet
          </h2>
          <p className="mt-2 max-w-sm text-sm text-[#555555]">
            Direct applications you start from Apply online will appear here.
          </p>
          <Link
            href="/apply"
            className="mt-6 rounded-full bg-[#007AFF] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#0062CC]"
          >
            Apply online
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {purchases.map((purchase) => {
              const active = purchase.id === selectedId;
              return (
                <button
                  key={purchase.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(purchase.id);
                    setDetailsOpen(false);
                  }}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap transition ${
                    active
                      ? "bg-[#007AFF] text-white shadow-sm shadow-[#007AFF]/20"
                      : "bg-white text-[#555555] ring-1 ring-gray-200 hover:bg-gray-50 hover:text-[#007AFF]"
                  }`}
                >
                  {purchase.schoolLogo ? (
                    <span className="relative h-6 w-6 overflow-hidden rounded-full bg-white">
                      <Image
                        src={purchase.schoolLogo}
                        alt=""
                        fill
                        className="object-contain p-0.5"
                      />
                    </span>
                  ) : (
                    <GraduationCap className="h-4 w-4" />
                  )}
                  {purchase.schoolName || "School"}
                </button>
              );
            })}
          </div>

          {selected ? (
            <article className="overflow-hidden rounded-[28px] border border-[#E8EEF5] bg-white">
              <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {selected.schoolLogo ? (
                    <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-[#E5E7EB]">
                      <Image
                        src={selected.schoolLogo}
                        alt=""
                        fill
                        className="object-contain p-1"
                      />
                    </span>
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#EEF6FF] text-[#007AFF]">
                      <GraduationCap className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-[#0F172A]">
                      {selected.schoolFullName || selected.schoolName || "Partner school"}
                    </h2>
                    <p className="truncate text-xs text-[#64748B]">
                      {selected.application?.applicationNumber ||
                        "Application not submitted yet"}
                      {" · Deadline "}
                      {formatSchoolDeadline(selected.deadline)}
                      {deadlineExpired ? " (closed)" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selected.application ? (
                    <button
                      type="button"
                      disabled={downloading}
                      onClick={() => {
                        const application = selected.application;
                        if (!application) return;
                        setDownloading(true);
                        void downloadApplicationPrintout({
                          school: {
                            name:
                              selected.schoolFullName ||
                              selected.schoolName ||
                              "School",
                            logoSrc: selected.schoolLogo,
                            brandColor: selected.schoolBrandColor,
                            brandColors: selected.schoolBrandColors,
                            phone: selected.schoolPhone,
                            email: selected.schoolEmail,
                            address: selected.schoolAddress,
                          },
                          data: printoutFromDetail(
                            application.detail || {
                              applicationNumber: application.applicationNumber,
                              programmes: programmesFor(selected),
                            },
                            programmesFor(selected),
                          ),
                        }).finally(() => setDownloading(false));
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-60"
                    >
                      {downloading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {downloading ? "Preparing PDF…" : "Download summary"}
                    </button>
                  ) : null}
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => setLoginOpen(true)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#007AFF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0062CC]"
                    >
                      <Pencil className="h-4 w-4" />
                      {selected.application
                        ? "Edit application"
                        : "Continue application"}
                    </button>
                  ) : (
                    <p className="self-center text-sm text-[#64748B]">
                      {deadlineExpired
                        ? "Editing is closed because the application deadline has passed."
                        : "This application can no longer be edited."}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                aria-expanded={detailsOpen}
                onClick={() => setDetailsOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-3 border-t border-[#EEF2F7] px-5 py-3 text-left text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC] sm:px-6"
              >
                <span>{detailsOpen ? "Hide details" : "View application details"}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform ${
                    detailsOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {detailsOpen ? (
                <div className="space-y-5 border-t border-[#EEF2F7] px-5 py-5 sm:px-6">
                  {selected.application ? (
                    <ApplicationStatusCard
                      status={selected.application.status}
                      schoolName={selected.schoolName}
                      reviewNotes={selected.application.detail?.reviewNotes}
                      admittedProgramme={
                        selected.application.admittedProgramme ||
                        selected.application.detail?.admittedProgramme
                      }
                      admittedProgrammeStream={
                        selected.application.admittedProgrammeStream ||
                        selected.application.detail?.admittedProgrammeStream
                      }
                      offerResponse={
                        selected.application.offerResponse ||
                        selected.application.detail?.offerResponse
                      }
                      onAcceptOffer={() => void respondToOffer("accepted")}
                      onDeclineOffer={() => void respondToOffer("declined")}
                      offerBusy={offerBusy}
                      compact
                    />
                  ) : (
                    <div className="rounded-[24px] border border-amber-100 bg-gradient-to-br from-[#FFFBEB] to-white p-4 sm:p-5">
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 ring-1 ring-amber-100">
                        Not submitted
                      </span>
                      <h3 className="mt-3 text-base font-semibold text-[#0F172A]">
                        You haven’t submitted this application yet
                      </h3>
                      <p className="mt-2 text-sm text-[#475569]">
                        Sign in with your serial number and PIN to fill the form
                        {deadlineExpired
                          ? ". The deadline has passed, so new edits are closed."
                          : " while the deadline is still open."}
                      </p>
                    </div>
                  )}
                  <ApplicationDocuments
                    documents={selected.application?.detail?.documents}
                    applicationNumber={selected.application?.applicationNumber}
                  />
                </div>
              ) : null}
            </article>
          ) : null}
        </div>
      )}

      {loginOpen && selected?.schoolId ? (
        <ApplicationLoginModal
          school={{
            id: selected.schoolId,
            name: selected.schoolFullName || selected.schoolName || "School",
            alias: selected.schoolName || null,
            slug: selected.schoolSlug ?? null,
            logoSrc: selected.schoolLogo ?? null,
          }}
          initialSerial={selected.voucher?.serial}
          initialPin={selected.voucher?.pin}
          onClose={() => setLoginOpen(false)}
        />
      ) : null}
    </div>
  );
}
