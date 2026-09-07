"use client";

import Link from "next/link";
import {
  studentStatusBadgeClass,
  studentStatusCopy,
} from "@/lib/admissions/status-messages";

export function ApplicationStatusCard({
  status,
  schoolName,
  reviewNotes,
  admittedProgramme,
  admittedProgrammeStream,
  offerResponse,
  onAcceptOffer,
  onDeclineOffer,
  offerBusy = false,
  compact = false,
}: {
  status: string;
  schoolName?: string | null;
  reviewNotes?: string | null;
  admittedProgramme?: string | null;
  admittedProgrammeStream?: string | null;
  offerResponse?: "accepted" | "declined" | null;
  onAcceptOffer?: () => void;
  onDeclineOffer?: () => void;
  offerBusy?: boolean;
  compact?: boolean;
}) {
  const copy = studentStatusCopy(status);
  const programmeLabel = [admittedProgramme, admittedProgrammeStream]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" — ");
  const isOffer =
    status === "Admitted" || status === "Approved" || status === "accepted";
  const awaitingResponse =
    isOffer && offerResponse !== "accepted" && offerResponse !== "declined";

  const toneClass =
    offerResponse === "declined"
      ? "border-amber-100 bg-gradient-to-br from-[#FFFBEB] to-white"
      : copy.tone === "success"
        ? "border-emerald-100 bg-gradient-to-br from-emerald-50 to-white"
        : copy.tone === "info"
          ? "border-sky-100 bg-gradient-to-br from-sky-50 to-white"
          : copy.tone === "care"
            ? "border-amber-100 bg-gradient-to-br from-[#FFFBEB] to-white"
            : "border-[#EEF2F7] bg-[#F8FAFC]";

  return (
    <div className={`rounded-[26px] border p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:p-6 ${toneClass}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] shadow-sm ${studentStatusBadgeClass(status)}`}
        >
          {offerResponse === "accepted"
            ? "Offer accepted"
            : offerResponse === "declined"
              ? "Offer declined"
              : copy.badge}
        </span>
        {schoolName ? (
          <span className="text-xs font-medium text-[#64748B]">{schoolName}</span>
        ) : null}
      </div>
      <h3 className="mt-4 text-lg font-bold leading-snug tracking-[-0.01em] text-[#0F172A]">
        {offerResponse === "accepted"
          ? "You accepted this admission offer"
          : offerResponse === "declined"
            ? "You declined this admission offer"
            : isOffer && programmeLabel
              ? `You've been admitted to ${programmeLabel}`
              : copy.title}
      </h3>
      <p
        className={`mt-2 text-sm leading-relaxed text-[#475569] ${compact ? "line-clamp-4" : ""}`}
      >
        {offerResponse === "accepted"
          ? "Thank you for accepting. Contact the admissions office to complete enrolment."
          : offerResponse === "declined"
            ? "Your decision has been recorded. You can explore other programmes on TertiaryGuide whenever you're ready."
            : isOffer && programmeLabel
              ? `Congratulations — ${schoolName || "the school"} has admitted you to study ${programmeLabel}. Please accept or decline this offer below.`
              : copy.message}
      </p>
      {programmeLabel && !offerResponse ? (
        <p className="mt-3 rounded-2xl bg-white/80 px-3 py-2 text-sm text-[#065F46]">
          <span className="font-semibold">Admitted programme: </span>
          {programmeLabel}
        </p>
      ) : null}
      {reviewNotes ? (
        <p className="mt-3 rounded-2xl bg-white/80 px-3 py-2 text-sm text-[#334155]">
          <span className="font-semibold">A note from the school: </span>
          {reviewNotes}
        </p>
      ) : null}
      {awaitingResponse && onAcceptOffer && onDeclineOffer ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={offerBusy}
            onClick={onAcceptOffer}
            className="inline-flex cursor-pointer items-center rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Accept offer
          </button>
          <button
            type="button"
            disabled={offerBusy}
            onClick={onDeclineOffer}
            className="inline-flex cursor-pointer items-center rounded-full border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-60"
          >
            Decline offer
          </button>
        </div>
      ) : null}
      {copy.tone === "care" || offerResponse === "declined" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/apply"
            className="inline-flex items-center rounded-full bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0062CC]"
          >
            Explore other schools
          </Link>
          <Link
            href="/university-forms"
            className="inline-flex items-center rounded-full border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#334155]"
          >
            Browse more forms
          </Link>
        </div>
      ) : null}
    </div>
  );
}
