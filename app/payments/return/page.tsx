"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";

/**
 * Public Paystack return URL (no dashboard auth).
 * Verifies payment, stores buyer email, then sends the user to My Forms.
 */
function PaymentReturnContent() {
  const searchParams = useSearchParams();
  const reference =
    searchParams.get("reference")?.trim() ||
    searchParams.get("trxref")?.trim() ||
    "";
  const from = searchParams.get("from")?.trim() || "";

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reference) {
      setError("Missing payment reference. Please open My Forms or contact support.");
      return;
    }

    let cancelled = false;

    async function complete() {
      const partnerUrl = `/api/apply/voucher/verify?reference=${encodeURIComponent(reference)}`;
      const formUrl = `/api/payments/forms/verify?reference=${encodeURIComponent(reference)}`;
      const endpoints =
        from === "partner"
          ? [partnerUrl, formUrl]
          : from === "form"
            ? [formUrl, partnerUrl]
            : // Default: partner first so secured-school buys are not mis-claimed as pending forms
              [partnerUrl, formUrl];

      let verifiedEmail: string | null = null;
      let lastError: string | null = null;
      let verifyFrom: "partner" | "form" | null = null;

      for (const url of endpoints) {
        try {
          const res = await fetch(url);
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            lastError =
              typeof data.error === "string"
                ? data.error
                : "Could not verify payment.";
            continue;
          }
          verifiedEmail =
            typeof data.email === "string"
              ? data.email.trim().toLowerCase()
              : null;
          verifyFrom = url.includes("/apply/voucher/") ? "partner" : "form";
          break;
        } catch {
          lastError = "Could not verify payment. Please try again.";
        }
      }

      if (cancelled) return;

      if (verifiedEmail) {
        try {
          window.localStorage.setItem("tg_user_email", verifiedEmail);
        } catch {
          // ignore
        }
        window.dispatchEvent(new CustomEvent("tg-purchases-updated"));
        const fromParam = verifyFrom || from || "";
        const qs = new URLSearchParams({ reference });
        if (fromParam === "partner" || fromParam === "form") {
          qs.set("from", fromParam);
        }
        window.location.replace(`/dashboard/my-forms?${qs.toString()}`);
        return;
      }

      setError(
        lastError ||
          "Payment could not be verified. If you were charged, check your email or contact support.",
      );
    }

    void complete();
    return () => {
      cancelled = true;
    };
  }, [reference, from]);

  return (
    <div className="min-h-screen bg-white text-[#1E1E1E]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pb-8 sm:px-6 md:gap-5 md:px-10 md:pb-10">
        <Header />
        <main className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
          {error ? (
            <>
              <p className="max-w-md text-sm text-[#DC2626]">{error}</p>
              <a
                href="/dashboard/my-forms"
                className="rounded-full bg-[#007AFF] px-6 py-2.5 text-sm font-semibold text-white"
              >
                Go to My Forms
              </a>
            </>
          ) : (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-[#007AFF]" />
              <p className="text-sm font-medium text-[#555555]">
                Confirming your payment and preparing your voucher…
              </p>
              <p className="max-w-sm text-xs text-[#6B7280]">
                Serial and PIN will be emailed to you and shown on My Forms.
              </p>
            </>
          )}
        </main>
      </div>
      <Footer />
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <Loader2 className="h-10 w-10 animate-spin text-[#007AFF]" />
        </div>
      }
    >
      <PaymentReturnContent />
    </Suspense>
  );
}
