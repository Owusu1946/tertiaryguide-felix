"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Header } from "../../../components/Header";
import { Footer } from "../../../components/Footer";

/**
 * Legacy Paystack callback for older transactions.
 * Verifies payment then sends the buyer to My Forms.
 */
function UniversityFormSuccessContent() {
  const searchParams = useSearchParams();
  const reference =
    searchParams.get("reference")?.trim() ||
    searchParams.get("trxref")?.trim() ||
    "";

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reference) {
      setError("Missing payment reference.");
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          `/api/payments/forms/verify?reference=${encodeURIComponent(reference)}`,
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Could not verify payment.");
        }
        if (cancelled) return;

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
        window.dispatchEvent(new CustomEvent("tg-purchases-updated"));
        window.location.replace(
          `/dashboard/my-forms?reference=${encodeURIComponent(reference)}`,
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not verify payment. Please contact support.",
          );
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reference]);

  return (
    <div className="min-h-screen bg-white text-[#1E1E1E]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pb-8 sm:px-6 md:gap-5 md:px-10 md:pb-10">
        <Header />

        <main className="space-y-6">
          <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
            Voucher purchase
          </h1>

          {error ? (
            <p className="text-sm text-[#DC2626]">{error}</p>
          ) : (
            <p className="inline-flex items-center gap-2 text-sm text-[#6B7280]">
              <Loader2 className="h-4 w-4 animate-spin text-[#007AFF]" />
              Verifying your payment and opening My Forms…
            </p>
          )}
        </main>
      </div>
      <Footer />
    </div>
  );
}

export default function UniversityFormSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <Loader2 className="h-10 w-10 animate-spin text-[#007AFF]" />
        </div>
      }
    >
      <UniversityFormSuccessContent />
    </Suspense>
  );
}
