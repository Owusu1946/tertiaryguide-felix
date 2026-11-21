"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, X } from "lucide-react";
import { writeApplySession } from "@/lib/admissions/applicant-session";
import { partnerSchoolBuyFormsHref } from "@/lib/school-links";
import { isDeadlineCalendarExpired } from "@/lib/deadlines";

export type ApplicationLoginSchool = {
  id: string;
  name: string;
  alias: string | null;
  slug: string | null;
  logoSrc: string | null;
  logoAlt?: string | null;
  deadline?: string | null;
};

function schoolLabel(school: ApplicationLoginSchool) {
  return school.alias?.trim() || school.name;
}

export function ApplicationLoginModal({
  school,
  onClose,
  initialSerial,
  initialPin,
}: {
  school: ApplicationLoginSchool;
  onClose: () => void;
  initialSerial?: string;
  initialPin?: string;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [serialNumber, setSerialNumber] = useState(initialSerial?.toUpperCase() ?? "");
  const [voucherCode, setVoucherCode] = useState(initialPin?.toUpperCase() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
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
      if (!res.ok) throw new Error(data.error || "Invalid serial number or PIN");

      const code = String(data.voucher?.voucherCode || voucherCode)
        .trim()
        .toUpperCase();
      const serial = String(data.voucher?.serialNumber || serialNumber)
        .trim()
        .toUpperCase();

      writeApplySession({
        schoolId: school.id,
        schoolSlug: school.slug,
        voucherCode: code,
        serialNumber: serial,
      });

      onClose();
      const params = new URLSearchParams({
        school: school.slug || school.id,
        step: "form",
        voucherCode: code,
        serialNumber: serial,
      });
      router.replace(`/apply?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  }

  if (!mounted) return null;

  const buyHref = partnerSchoolBuyFormsHref(school);
  const deadlineExpired = isDeadlineCalendarExpired(school.deadline ?? null);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-login-title"
        className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]"
          aria-label="Close login"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="bg-gradient-to-br from-[#EFF6FF] to-white px-5 pb-4 pt-6 sm:px-6">
          <div className="flex items-center gap-3 pr-10">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-[#E8EEF5]">
              {school.logoSrc ? (
                <Image
                  src={school.logoSrc}
                  alt={school.logoAlt || schoolLabel(school)}
                  fill
                  className="object-contain p-1"
                  sizes="48px"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[#007AFF]">
                  <GraduationCap className="h-5 w-5" />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h2
                id="application-login-title"
                className="text-lg font-semibold text-[#0F172A]"
              >
                Application portal
              </h2>
              <p className="truncate text-sm text-[#64748B]">
                {schoolLabel(school)}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[#6B7280]">
            Enter the serial number and PIN from your form purchase to continue
            your application.
          </p>
        </div>

        <form onSubmit={(e) => void handleLogin(e)} className="grid gap-4 px-5 py-5 sm:px-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[#111827]">Serial number</span>
            <input
              required
              autoFocus
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 font-mono text-sm text-[#111827] caret-[#111827] outline-none placeholder:text-[#9CA3AF] focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20"
              placeholder="TG-2026-001234"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[#111827]">PIN</span>
            <input
              required
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 font-mono text-sm text-[#111827] caret-[#111827] outline-none placeholder:text-[#9CA3AF] focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20"
              placeholder="HS-8K7D-29PX"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#007AFF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0066D6] disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <div className="border-t border-[#F1F5F9] px-5 py-4 text-center sm:px-6">
          {deadlineExpired ? (
            <p className="text-sm leading-relaxed text-red-600">
              This school&apos;s application deadline has passed. New form
              purchases are not available.
            </p>
          ) : (
            <>
              <p className="text-sm text-[#6B7280]">Don’t have a form yet?</p>
              <button
                type="button"
                onClick={() => router.push(buyHref)}
                className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[#007AFF] bg-white px-5 py-2.5 text-sm font-semibold text-[#007AFF] hover:bg-[#F0F7FF]"
              >
                Buy new forms
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
