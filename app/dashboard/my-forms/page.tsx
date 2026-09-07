"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy,
  ExternalLink,
  GraduationCap,
  Loader2,
  MousePointerClick,
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

export default function MyFormsDashboardPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flippedIds, setFlippedIds] = useState<Set<string>>(new Set());
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const [showAssistance, setShowAssistance] = useState(false);
  const [assistanceSession, setAssistanceSession] = useState(0);

  async function fetchPurchases(): Promise<Purchase[]> {
    try {
      const email = window.localStorage.getItem("tg_user_email");
      if (!email) {
        setError("User email not found. Please log in.");
        setLoading(false);
        return [];
      }

      const res = await fetch(`/api/user/purchases?email=${encodeURIComponent(email)}`);
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
              : // Default: partner first so secured-school buys fulfil + email correctly
                [partnerUrl, formUrl];

        let verifiedEmail: string | null = null;
        let highlightSerial: string | null = null;

        for (const url of endpoints) {
          try {
            const res = await fetch(url);
            const data = await res.json();
            if (!res.ok) continue;
            verifiedEmail =
              typeof data.email === "string" ? data.email.trim().toLowerCase() : null;
            highlightSerial =
              data.voucher?.serial ||
              data.voucher?.serialNumber ||
              null;
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
          const match = list.find(
            (p) => p.voucher?.serial === highlightSerial,
          );
          if (match) {
            setFlippedIds(new Set([match.id]));
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

  const toggleFlip = (id: string) => {
    setFlippedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isNoFlipTarget = (target: EventTarget | null) =>
    target instanceof Element && Boolean(target.closest("[data-no-flip]"));

  const onCardPointerDown = (event: React.PointerEvent) => {
    if (isNoFlipTarget(event.target)) {
      pointerStart.current = null;
      return;
    }
    pointerStart.current = { x: event.clientX, y: event.clientY };
  };

  const onCardPointerUp = (event: React.PointerEvent, id: string) => {
    if (isNoFlipTarget(event.target)) {
      pointerStart.current = null;
      return;
    }
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const moved =
      Math.abs(event.clientX - start.x) > 10 ||
      Math.abs(event.clientY - start.y) > 10;
    if (moved) return;
    toggleFlip(id);
  };

  const onCardKeyDown = (event: React.KeyboardEvent, id: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleFlip(id);
    }
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

  function statusLabel(purchase: Purchase) {
    if (purchase.status === "pending") return "Pending voucher";
    if (purchase.type === "partner_voucher") return "Ready to apply";
    return "Active";
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 py-20">
        <Loader2 className="h-10 w-10 animate-spin text-[#007AFF]" />
        <p className="text-sm font-medium text-[#555555]">Loading your forms...</p>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        .form-vouchers-scroll {
          display: flex;
          gap: 1.25rem;
          overflow-x: auto;
          overflow-y: hidden;
          overscroll-behavior-x: contain;
          scroll-snap-type: x proximity;
          -webkit-overflow-scrolling: touch;
          padding: 4px 2px 12px;
          scrollbar-width: thin;
        }
        .form-flip-card {
          background-color: transparent;
          perspective: 1000px;
          flex: 0 0 min(85vw, 340px);
          scroll-snap-align: start;
        }
        @media (min-width: 768px) {
          .form-flip-card {
            flex-basis: 360px;
          }
        }
        .form-flip-card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          min-height: inherit;
          transition: transform 0.6s;
          transform-style: preserve-3d;
          cursor: pointer;
        }
        .form-flip-card.flipped .form-flip-card-inner {
          transform: rotateY(180deg);
        }
        .form-flip-card-front,
        .form-flip-card-back {
          position: absolute;
          inset: 0;
          width: 100%;
          min-height: 100%;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          border-radius: 32px;
        }
        .form-flip-card-back {
          transform: rotateY(180deg);
          overflow: hidden;
        }
        .form-flip-card-back-scroll {
          height: 100%;
          overflow-x: hidden;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
        }
        .form-shimmer {
          position: absolute;
          top: 0;
          left: 0;
          width: 200%;
          height: 100%;
          background: linear-gradient(
            to right,
            transparent 0%,
            rgba(255, 255, 255, 0) 30%,
            rgba(255, 255, 255, 0.12) 50%,
            rgba(255, 255, 255, 0) 70%,
            transparent 100%
          );
          transform: skewX(-20deg);
          animation: form-shimmer 3s infinite linear;
          pointer-events: none;
        }
        @keyframes form-shimmer {
          0% {
            transform: translateX(-150%) skewX(-20deg);
          }
          100% {
            transform: translateX(50%) skewX(-20deg);
          }
        }
      `}</style>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold leading-tight text-[#1E1E1E] sm:text-3xl">
            My Forms
          </h1>
          <p className="text-sm text-[#555555]">
            Your vouchers in one place
          </p>
        </div>

        <div className="relative shrink-0">
          {!showAssistance ? (
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-full bg-[#007AFF] px-6 text-sm font-semibold text-white shadow-lg shadow-[#007AFF]/10 transition-all hover:bg-[#0062CC] hover:shadow-xl active:scale-95"
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
        <div className="mt-8 rounded-3xl bg-[#FEF2F2] p-8 text-center">
          <p className="text-sm font-medium text-[#B91C1C]">{error}</p>
        </div>
      ) : purchases.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-[32px] border border-[#E8EEF5] bg-white py-20 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF6FF]">
            <GraduationCap className="h-7 w-7 text-[#007AFF]" />
          </span>
          <h2 className="mb-2 text-xl font-bold text-[#1E1E1E]">No vouchers yet</h2>
          <p className="mb-8 max-w-sm text-sm text-[#555555]">
            Buy a university form or a direct-application voucher and it will
            show up here.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/university-forms"
              className="rounded-full bg-[#007AFF] px-8 py-3 text-sm font-medium text-white transition hover:bg-[#0062CC]"
            >
              Browse Forms
            </Link>
            <Link
              href="/apply"
              className="rounded-full border border-[#007AFF] px-8 py-3 text-sm font-medium text-[#007AFF] transition hover:bg-[#EFF6FF]"
            >
              Apply online
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <p className="mb-5 text-sm text-[#64748B]">
            Tap a card to flip it and view the serial and PIN. Tap again to
            flip it back.
          </p>
          <div className="form-vouchers-scroll">
              {purchases.map((purchase) => {
                const isFlipped = flippedIds.has(purchase.id);
                const isPartner = purchase.type === "partner_voucher";
                const cardMinHeight = isFlipped
                  ? purchase.voucher
                    ? isPartner
                      ? 360
                      : 300
                    : 260
                  : 220;

                return (
                  <div
                    key={purchase.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isFlipped}
                    aria-label={`${purchase.schoolName || "School form"} voucher. ${isFlipped ? "Showing serial and PIN. Activate to flip back." : "Activate to view serial and PIN."}`}
                    className={`form-flip-card ${isFlipped ? "flipped" : ""}`}
                    style={{ minHeight: cardMinHeight }}
                    onPointerDown={onCardPointerDown}
                    onPointerUp={(event) => onCardPointerUp(event, purchase.id)}
                    onKeyDown={(event) => onCardKeyDown(event, purchase.id)}
                  >
                    <div
                      className="form-flip-card-inner"
                      style={{ minHeight: cardMinHeight }}
                    >
                      <article
                        className={`form-flip-card-front flex flex-col justify-between px-8 py-8 shadow-sm transition-shadow hover:shadow-md ${
                          isPartner
                            ? "bg-gradient-to-br from-[#ECFDF5] to-[#A7F3D0]"
                            : "bg-gradient-to-br from-[#EFF6FF] to-[#BFDBFE]"
                        }`}
                      >
                        <div>
                          <div className="mb-4 flex items-center justify-between gap-3">
                            {purchase.schoolLogo ? (
                              <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white/80 ring-1 ring-black/5">
                                <Image
                                  src={purchase.schoolLogo}
                                  alt=""
                                  fill
                                  className="object-contain p-1"
                                />
                              </span>
                            ) : (
                              <span
                                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/80 ${
                                  isPartner ? "text-[#0F766E]" : "text-[#007AFF]"
                                }`}
                              >
                                <GraduationCap className="h-5 w-5" />
                              </span>
                            )}
                            <span
                              className={`rounded-full bg-white/70 px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                isPartner ? "text-[#0F766E]" : "text-[#007AFF]"
                              }`}
                            >
                              {statusLabel(purchase)}
                            </span>
                          </div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-black/40">
                            {isPartner ? "Direct apply" : "University form"}
                          </p>
                          <h2 className="mt-1 text-xl font-bold leading-tight text-[#1E1E1E]">
                            {purchase.schoolName || "School form"}
                          </h2>
                          <p className="mt-2 text-xs font-medium text-[#555555]">
                            {purchase.programmeLevel === "postgraduate"
                              ? "Postgraduate"
                              : "Undergraduate"}{" "}
                            &middot;{" "}
                            {new Date(purchase.date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <div
                          className={`flex items-center gap-2 ${
                            isPartner ? "text-[#0F766E]" : "text-[#007AFF]"
                          }`}
                        >
                          <MousePointerClick className="h-4 w-4" />
                          <span className="text-xs font-bold uppercase tracking-wide">
                            Click to view details
                          </span>
                        </div>
                      </article>

                      <article className="form-flip-card-back flex flex-col bg-[#0d1117] text-white shadow-xl">
                        <div className="form-shimmer" />
                        <div className="form-flip-card-back-scroll relative z-10 flex min-h-0 flex-1 flex-col px-6 py-6">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                            Serial &amp; PIN
                          </p>
                          {purchase.voucher ? (
                            <ul className="mt-3 space-y-3">
                              <li className="rounded-2xl border border-[#E5E7EB] bg-white p-3">
                                <div className="mb-2 flex items-center justify-between">
                                  <span className="text-[9px] font-bold uppercase text-[#6B7280]">
                                    Serial
                                  </span>
                                  <button
                                    type="button"
                                    data-no-flip
                                    onClick={(e) =>
                                      copyToClipboard(
                                        e,
                                        purchase.voucher!.serial,
                                        `${purchase.id}-serial`,
                                      )
                                    }
                                    className="flex items-center gap-1 rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[9px] font-bold text-[#374151] transition hover:bg-[#E5E7EB]"
                                  >
                                    Copy
                                    <Copy
                                      className={`h-2.5 w-2.5 ${
                                        copyingId === `${purchase.id}-serial`
                                          ? "text-[#16A34A]"
                                          : ""
                                      }`}
                                    />
                                  </button>
                                </div>
                                <p className="break-all font-mono text-sm font-bold tracking-tight text-[#111827]">
                                  {purchase.voucher.serial}
                                </p>
                                <div className="mt-2 flex items-center justify-between border-t border-[#E5E7EB] pt-2">
                                  <span className="text-[9px] font-bold uppercase text-[#6B7280]">
                                    PIN
                                  </span>
                                  <button
                                    type="button"
                                    data-no-flip
                                    onClick={(e) =>
                                      copyToClipboard(
                                        e,
                                        purchase.voucher!.pin,
                                        `${purchase.id}-pin`,
                                      )
                                    }
                                    className="flex items-center gap-1 rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[9px] font-bold text-[#374151] transition hover:bg-[#E5E7EB]"
                                  >
                                    Copy
                                    <Copy
                                      className={`h-2.5 w-2.5 ${
                                        copyingId === `${purchase.id}-pin`
                                          ? "text-[#16A34A]"
                                          : ""
                                      }`}
                                    />
                                  </button>
                                </div>
                                <p className="mt-0.5 font-mono text-sm font-bold tracking-widest text-[#111827]">
                                  {purchase.voucher.pin}
                                </p>
                              </li>
                            </ul>
                          ) : (
                            <div className="mt-4 flex flex-col items-center justify-center py-6 text-center">
                              <Loader2 className="mb-2 h-6 w-6 animate-spin text-white/40" />
                              <p className="text-sm font-medium text-white/60">
                                Issuing voucher…
                              </p>
                              <p className="mt-2 max-w-[220px] text-[11px] leading-relaxed text-white/40">
                                Your serial and PIN will appear here shortly. Use
                                Get assistance if you need help.
                              </p>
                            </div>
                          )}

                          {isPartner && purchase.voucher ? (
                            <button
                              type="button"
                              data-no-flip
                              onClick={(e) => {
                                e.stopPropagation();
                                void openPartnerApplication(purchase);
                              }}
                              disabled={openingId === purchase.id}
                              className="relative z-10 mt-4 inline-flex items-center justify-center gap-1.5 rounded-full bg-[#007AFF] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0062CC] disabled:opacity-60"
                            >
                              {openingId === purchase.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <ExternalLink className="h-3.5 w-3.5" />
                              )}
                              Open application
                            </button>
                          ) : null}

                          <p className="mt-auto pt-4 text-center text-[10px] font-medium italic text-white/40">
                            Tap to flip back
                          </p>
                        </div>
                      </article>
                    </div>
                  </div>
                );
              })}
            </div>
        </div>
      )}
    </>
  );
}
