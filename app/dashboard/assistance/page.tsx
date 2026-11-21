"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AssistanceRequestForm } from "@/app/components/AssistanceRequestForm";

export default function DashboardAssistancePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const email = window.localStorage.getItem("tg_user_email");
    if (!email) {
      router.replace(
        `/signin?redirect=${encodeURIComponent("/dashboard/assistance")}`,
      );
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 py-16">
        <Loader2 className="h-10 w-10 animate-spin text-[#007AFF]" />
        <p className="text-sm font-medium text-[#555555]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold leading-tight text-[#1E1E1E]">
          Assistance
        </h1>
      </div>
      <AssistanceRequestForm
        variant="page"
        onClose={() => router.push("/dashboard/my-forms")}
      />
    </div>
  );
}
