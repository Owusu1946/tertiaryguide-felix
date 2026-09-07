"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Copy, GraduationCap, Loader2, MousePointerClick } from "lucide-react";
import { adminFetch } from "@/lib/admin-client";

type PartnerVoucherItem = {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolFullName: string;
  schoolLogo: string | null;
  serial: string;
  pin: string;
  email: string | null;
  fullName: string | null;
  programmeLevel: string;
  createdAt: string;
  paidAt: string | null;
};

type SchoolGroup = {
  schoolId: string;
  schoolName: string;
  schoolFullName: string;
  schoolLogo: string | null;
  count: number;
  vouchers: PartnerVoucherItem[];
};

export function AdminPartnerVouchersSection() {
  const [schools, setSchools] = useState<SchoolGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flippedIds, setFlippedIds] = useState<Set<string>>(new Set());
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [activeSchoolId, setActiveSchoolId] = useState<string | "all">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch("/api/admin/partner-vouchers");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load partner vouchers");
      setSchools(data.schools || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const vouchers =
    activeSchoolId === "all"
      ? schools.flatMap((s) => s.vouchers)
      : schools.find((s) => s.schoolId === activeSchoolId)?.vouchers || [];

  const toggleFlip = (id: string) => {
    setFlippedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(text);
    setCopyingId(id);
    setTimeout(() => setCopyingId(null), 2000);
  };

  return (
    <section className="space-y-6">
      <style jsx global>{`
        .partner-vouchers-scroll {
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
        .partner-flip-card {
          background-color: transparent;
          perspective: 1000px;
          flex: 0 0 min(85vw, 320px);
          scroll-snap-align: start;
          min-height: 240px;
        }
        .partner-flip-card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          min-height: inherit;
          transition: transform 0.6s;
          transform-style: preserve-3d;
          cursor: pointer;
        }
        .partner-flip-card.flipped .partner-flip-card-inner {
          transform: rotateY(180deg);
        }
        .partner-flip-card-front,
        .partner-flip-card-back {
          position: absolute;
          inset: 0;
          width: 100%;
          min-height: 100%;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          border-radius: 28px;
        }
        .partner-flip-card-back {
          transform: rotateY(180deg);
        }
      `}</style>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#0F172A]">
            Partner school vouchers
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Track auto-generated vouchers sold for secured / apply-online
            schools. Tap a card to see serial, PIN, and buyer email.
          </p>
        </div>
        <p className="rounded-full bg-[#ECFDF5] px-3 py-1 text-xs font-semibold text-[#047857]">
          {total} voucher{total === 1 ? "" : "s"} sold
        </p>
      </div>

      {schools.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveSchoolId("all")}
            className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold ${
              activeSchoolId === "all"
                ? "bg-[#007AFF] text-white"
                : "border border-[#E5E7EB] bg-white text-[#334155]"
            }`}
          >
            All schools
          </button>
          {schools.map((s) => (
            <button
              key={s.schoolId}
              type="button"
              onClick={() => setActiveSchoolId(s.schoolId)}
              className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold ${
                activeSchoolId === s.schoolId
                  ? "bg-[#007AFF] text-white"
                  : "border border-[#E5E7EB] bg-white text-[#334155]"
              }`}
            >
              {s.schoolName} ({s.count})
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-[#007AFF]" />
        </div>
      ) : error ? (
        <p className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      ) : vouchers.length === 0 ? (
        <p className="rounded-3xl border border-[#E5E7EB] bg-white px-6 py-12 text-center text-sm text-[#64748B]">
          No partner school vouchers purchased yet.
        </p>
      ) : (
        <div className="partner-vouchers-scroll">
          {vouchers.map((v) => {
            const flipped = flippedIds.has(v.id);
            return (
              <div
                key={v.id}
                role="button"
                tabIndex={0}
                aria-pressed={flipped}
                className={`partner-flip-card ${flipped ? "flipped" : ""}`}
                onClick={() => toggleFlip(v.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleFlip(v.id);
                  }
                }}
              >
                <div className="partner-flip-card-inner">
                  <article className="partner-flip-card-front flex flex-col justify-between bg-gradient-to-br from-[#ECFDF5] to-[#A7F3D0] px-6 py-6 shadow-sm">
                    <div>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        {v.schoolLogo ? (
                          <span className="relative h-10 w-10 overflow-hidden rounded-full bg-white/80">
                            <Image
                              src={v.schoolLogo}
                              alt=""
                              fill
                              className="object-contain p-1"
                            />
                          </span>
                        ) : (
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-[#0F766E]">
                            <GraduationCap className="h-4 w-4" />
                          </span>
                        )}
                        <span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-bold uppercase text-[#0F766E]">
                          {v.programmeLevel === "postgraduate"
                            ? "Postgraduate"
                            : "Undergraduate"}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-black/40">
                        Partner voucher
                      </p>
                      <h3 className="mt-1 text-lg font-bold text-[#0F172A]">
                        {v.schoolName}
                      </h3>
                      <p className="mt-2 truncate text-xs text-[#334155]">
                        {v.fullName || v.email || "Buyer"}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-[#64748B]">
                        {v.email || "No email"}
                      </p>
                      <p className="mt-2 text-[11px] text-[#64748B]">
                        {new Date(v.paidAt || v.createdAt).toLocaleDateString(
                          "en-GB",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          },
                        )}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-[#0F766E]">
                      <MousePointerClick className="h-4 w-4" />
                      <span className="text-xs font-bold uppercase tracking-wide">
                        Click for serial &amp; PIN
                      </span>
                    </div>
                  </article>

                  <article className="partner-flip-card-back flex flex-col bg-[#0d1117] px-5 py-5 text-white shadow-xl">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                      Serial &amp; PIN
                    </p>
                    <div className="mt-3 rounded-2xl border border-[#E5E7EB] bg-white p-3 text-[#111827]">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase text-[#6B7280]">
                          Serial
                        </span>
                        <button
                          type="button"
                          data-no-flip
                          onClick={(e) =>
                            copyToClipboard(e, v.serial, `${v.id}-serial`)
                          }
                          className="flex cursor-pointer items-center gap-1 rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[9px] font-bold text-[#374151]"
                        >
                          Copy
                          <Copy
                            className={`h-2.5 w-2.5 ${
                              copyingId === `${v.id}-serial`
                                ? "text-[#16A34A]"
                                : ""
                            }`}
                          />
                        </button>
                      </div>
                      <p className="break-all font-mono text-sm font-bold">
                        {v.serial}
                      </p>
                      <div className="mt-2 flex items-center justify-between border-t border-[#E5E7EB] pt-2">
                        <span className="text-[9px] font-bold uppercase text-[#6B7280]">
                          PIN
                        </span>
                        <button
                          type="button"
                          data-no-flip
                          onClick={(e) =>
                            copyToClipboard(e, v.pin, `${v.id}-pin`)
                          }
                          className="flex cursor-pointer items-center gap-1 rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[9px] font-bold text-[#374151]"
                        >
                          Copy
                          <Copy
                            className={`h-2.5 w-2.5 ${
                              copyingId === `${v.id}-pin` ? "text-[#16A34A]" : ""
                            }`}
                          />
                        </button>
                      </div>
                      <p className="mt-0.5 font-mono text-sm font-bold tracking-widest">
                        {v.pin}
                      </p>
                    </div>
                    <p className="mt-3 text-xs text-white/60">
                      Buyer: {v.email || "—"}
                    </p>
                    <p className="mt-auto pt-3 text-center text-[10px] italic text-white/40">
                      Tap to flip back
                    </p>
                  </article>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
