"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  GraduationCap,
  Loader2,
} from "lucide-react";
import { AssistanceRequestForm } from "@/app/components/AssistanceRequestForm";
import { writeApplySession } from "@/lib/admissions/applicant-session";

interface Purchase {
  id: string;
  type: "university_form" | "partner_voucher";
  schoolId?: string;
  schoolName?: string;
  schoolLogo?: string | null;
  schoolSlug?: string | null;
  name?: string;
  date: string;
  voucher?: { serial: string; pin: string } | null;
  programmeLevel?: "undergraduate" | "postgraduate";
  status: "issued" | "pending" | "used";
}

const APPLICANT_SESSION_KEY = "tg_applicant_session";

function formatPurchaseDate(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusMeta(purchase: Purchase) {
  if (purchase.status === "pending") {
    return {
      label: "Pending",
      className: "bg-[#FFF7ED] text-[#C2410C]",
    };
  }
  if (purchase.type === "partner_voucher") {
    return {
      label: "Ready to apply",
      className: "bg-[#ECFDF5] text-[#0F766E]",
    };
  }
  return {
    label: "Active",
    className: "bg-[#EFF6FF] text-[#007AFF]",
  };
}

export default function MyFormsDashboardPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [showAssistance, setShowAssistance] = useState(false);
  const [assistanceSession, setAssistanceSession] = useState(0);
  const highlightRef = useRef<string | null>(null);

  async function fetchPurchases(): Promise<Purchase[]> {
    try {
      const email = window.localStorage.getItem("tg_user_email");
      if (!email) {
        setError("User email not found. Please log in.");
        setLoading(false);
        return [];
      }

      const res = await fetch(
        `/api/user/purchases?email=${encodeURIComponent(email)}`,
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to fetch purchases.");
        return [];
      }

      const filtered = ((data.purchases || []) as Purchase[]).filter(
        (p) =>
          p.type === "university_form" || p.type === "partner_voucher",
      );
      setPurchases(filtered);
      setError(null);
      return filtered;
    } catch {
      setError("Something went wrong. Please try again.");
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    async function boot() {
      const params = new URLSearchParams(window.location.search);
      const reference = params.get("reference")?.trim();
      const from = params.get("from");

      if (reference) {
        setLoading(true);
        const partnerUrl = `/api/apply/voucher/verify?reference=${encodeURIComponent(reference)}`;
        const formUrl = `/api/payments/forms/verify?reference=${encodeURIComponent(reference)}`;
        const endpoints =
          from === "partner"
            ? [partnerUrl, formUrl]
            : from === "form"
              ? [formUrl, partnerUrl]
              : [partnerUrl, formUrl];

        let verifiedEmail: string | null = null;
        let highlightSerial: string | null = null;

        for (const url of endpoints) {
          try {
            const res = await fetch(url);
            const data = await res.json();
            if (!res.ok) continue;
            verifiedEmail =
              typeof data.email === "string"
                ? data.email.trim().toLowerCase()
                : null;
            highlightSerial =
              data.voucher?.serial || data.voucher?.serialNumber || null;
            break;
          } catch {
            // try the next verify endpoint
          }
        }

        if (verifiedEmail) {
          window.localStorage.setItem("tg_user_email", verifiedEmail);
        }

        window.history.replaceState({}, "", "/dashboard/my-forms");
        window.dispatchEvent(new CustomEvent("tg-purchases-updated"));

        const list: Purchase[] = cancelled ? [] : await fetchPurchases();
        if (!cancelled && highlightSerial) {
          const match = list.find((p) => p.voucher?.serial === highlightSerial);
          if (match) {
            highlightRef.current = match.id;
            setExpandedIds(new Set([match.id]));
          }
        }
        return;
      }

      const email = window.localStorage.getItem("tg_user_email");
      if (!email) {
        router.replace(
          `/signin?redirect=${encodeURIComponent("/dashboard/my-forms")}`,
        );
        return;
      }

      void fetchPurchases();
    }

    void boot();

    const handleUpdate = () => {
      void fetchPurchases();
    };

    window.addEventListener("tg-purchases-updated", handleUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("tg-purchases-updated", handleUpdate);
    };
  }, [router]);

  const copyToClipboard = (
    e: React.MouseEvent,
    text: string,
    id: string,
  ) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(text);
    setCopyingId(id);
    setTimeout(() => setCopyingId(null), 2000);
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openPartnerApplication = async (purchase: Purchase) => {
    if (!purchase.schoolId || !purchase.voucher) return;

    setOpeningId(purchase.id);
    try {
      const res = await fetch("/api/apply/voucher/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: purchase.schoolId,
          voucherCode: purchase.voucher.pin,
          serialNumber: purchase.voucher.serial,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not open application");

      writeApplySession({
        schoolId: data.school.id,
        schoolSlug: data.school.slug,
        voucherCode: data.voucher.voucherCode,
        serialNumber: data.voucher.serialNumber,
        email: window.localStorage.getItem("tg_user_email") || undefined,
      });

      window.localStorage.setItem(
        APPLICANT_SESSION_KEY,
        JSON.stringify({
          schoolId: data.school.id,
          schoolName: data.school.name,
          schoolSlug: data.school.slug,
          brandColor: data.school.brandColor ?? null,
          voucherCode: data.voucher.voucherCode,
          serialNumber: data.voucher.serialNumber,
          application: data.application,
          canEdit: data.canEdit !== false,
        }),
      );

      router.push("/apply/portal");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not open your application. Please try again.",
      );
    } finally {
      setOpeningId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="h-8 w-8 animate-spin text-[#007AFF]" />
        <p className="text-sm text-[#555555]">Loading your forms…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-[#1E1E1E] sm:text-3xl">
            My Forms
          </h1>
        </div>

        <div className="relative w-full shrink-0 sm:w-auto">
          {!showAssistance ? (
            <button
              type="button"
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[#007AFF] px-6 text-sm font-semibold text-white shadow-sm shadow-[#007AFF]/20 transition hover:bg-[#0062CC] active:scale-[0.98] sm:w-auto"
              onClick={() => {
                setAssistanceSession((s) => s + 1);
                setShowAssistance(true);
              }}
            >
              Get assistance
            </button>
          ) : (
            <AssistanceRequestForm
              key={assistanceSession}
              variant="drawer"
              onClose={() => setShowAssistance(false)}
            />
          )}
        </div>
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
            No vouchers yet
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#555555]">
            Buy a university form or a direct-application voucher and it will
            show up here.
          </p>
          <div className="mt-6 flex w-full max-w-sm flex-col gap-2.5 sm:max-w-none sm:flex-row sm:justify-center">
            <Link
              href="/university-forms"
              className="inline-flex h-11 items-center justify-center rounded-full bg-[#007AFF] px-6 text-sm font-semibold text-white transition hover:bg-[#0062CC] active:scale-[0.98]"
            >
              Browse forms
            </Link>
            <Link
              href="/apply"
              className="inline-flex h-11 items-center justify-center rounded-full border border-[#007AFF] bg-white px-6 text-sm font-semibold text-[#007AFF] transition hover:bg-[#EFF6FF] active:scale-[0.98]"
            >
              Apply online
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {purchases.map((purchase) => {
            const expanded = expandedIds.has(purchase.id);
            const isPartner = purchase.type === "partner_voucher";
            const status = statusMeta(purchase);
            const levelLabel =
              purchase.programmeLevel === "postgraduate"
                ? "Postgraduate"
                : "Undergraduate";
            const highlighted = highlightRef.current === purchase.id;

            return (
              <article
                key={purchase.id}
                className={`overflow-hidden rounded-[24px] border bg-white shadow-sm transition sm:rounded-[28px] ${
                  highlighted
                    ? "border-[#007AFF]/35 ring-2 ring-[#007AFF]/15"
                    : "border-[#E8EEF5]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleExpanded(purchase.id)}
                  aria-expanded={expanded}
                  className="flex w-full items-start gap-3 px-4 py-4 text-left [touch-action:manipulation] active:bg-[#F8FAFC] sm:items-center sm:gap-4 sm:px-5 sm:py-5"
                >
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
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl sm:h-14 sm:w-14 ${
                        isPartner
                          ? "bg-[#ECFDF5] text-[#0F766E]"
                          : "bg-[#EEF6FF] text-[#007AFF]"
                      }`}
                    >
                      <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6" />
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${status.className}`}
                      >
                        {status.label}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                        {isPartner ? "Direct apply" : "University form"}
                      </span>
                    </div>
                    <h2 className="mt-1.5 text-[15px] font-semibold leading-snug text-[#0F172A] sm:text-base sm:leading-tight">
                      {purchase.schoolName || "School form"}
                    </h2>
                    <p className="mt-1 text-xs text-[#64748B] sm:text-sm">
                      {levelLabel}
                      <span className="mx-1.5 text-[#CBD5E1]">·</span>
                      {formatPurchaseDate(purchase.date)}
                    </p>
                  </div>

                  <span
                    className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F8FAFC] text-[#64748B] transition sm:mt-0 ${
                      expanded ? "rotate-180 bg-[#EFF6FF] text-[#007AFF]" : ""
                    }`}
                    aria-hidden
                  >
                    <ChevronDown className="h-4 w-4" />
                  </span>
                </button>

                {expanded ? (
                  <div className="border-t border-[#F1F5F9] bg-[#FAFBFC] px-4 py-4 sm:px-5 sm:py-5">
                    {purchase.voucher ? (
                      <div className="space-y-3">
                        <div className="rounded-2xl border border-[#E8EEF5] bg-white p-3.5 sm:p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                                Serial number
                              </p>
                              <p className="mt-1 break-all font-mono text-sm font-semibold tracking-tight text-[#0F172A]">
                                {purchase.voucher.serial}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) =>
                                copyToClipboard(
                                  e,
                                  purchase.voucher!.serial,
                                  `${purchase.id}-serial`,
                                )
                              }
                              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F1F5F9] px-2.5 py-1.5 text-[11px] font-semibold text-[#334155] transition hover:bg-[#E2E8F0] active:scale-[0.98]"
                            >
                              {copyingId === `${purchase.id}-serial` ? (
                                <>
                                  <Check className="h-3 w-3 text-[#16A34A]" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  Copy
                                </>
                              )}
                            </button>
                          </div>

                          <div className="mt-3 border-t border-[#F1F5F9] pt-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                                  PIN
                                </p>
                                <p className="mt-1 font-mono text-sm font-semibold tracking-widest text-[#0F172A]">
                                  {purchase.voucher.pin}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={(e) =>
                                  copyToClipboard(
                                    e,
                                    purchase.voucher!.pin,
                                    `${purchase.id}-pin`,
                                  )
                                }
                                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F1F5F9] px-2.5 py-1.5 text-[11px] font-semibold text-[#334155] transition hover:bg-[#E2E8F0] active:scale-[0.98]"
                              >
                                {copyingId === `${purchase.id}-pin` ? (
                                  <>
                                    <Check className="h-3 w-3 text-[#16A34A]" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3" />
                                    Copy
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {isPartner ? (
                          <button
                            type="button"
                            onClick={() => void openPartnerApplication(purchase)}
                            disabled={openingId === purchase.id}
                            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#007AFF] px-5 text-sm font-semibold text-white shadow-sm shadow-[#007AFF]/20 transition hover:bg-[#0062CC] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {openingId === purchase.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ExternalLink className="h-4 w-4" />
                            )}
                            Open application
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#E2E8F0] bg-white px-4 py-8 text-center">
                        <Loader2 className="mb-2 h-5 w-5 animate-spin text-[#007AFF]" />
                        <p className="text-sm font-medium text-[#0F172A]">
                          Issuing voucher…
                        </p>
                        <p className="mt-1 max-w-xs text-xs leading-relaxed text-[#64748B]">
                          Your serial and PIN will appear here shortly. Use Get
                          assistance if you need help.
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
