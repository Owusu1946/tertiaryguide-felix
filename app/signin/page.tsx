"use client";

import React, { useState, Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Compass, GraduationCap, Sparkles } from "lucide-react";
import { PasswordInput } from "@/app/components/PasswordInput";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const resetToastShown = useRef(false);

  useEffect(() => {
    if (resetToastShown.current) return;
    if (searchParams.get("reset") !== "success") return;
    resetToastShown.current = true;
    setToast("Your password was reset. Sign in with your new password.");
    router.replace(
      `/signin${redirect !== "/" ? `?redirect=${encodeURIComponent(redirect)}` : ""}`,
    );
  }, [searchParams, router, redirect]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setError(null);

    if (!identifier || !password) {
      setError("Please enter your username and password.");
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: identifier,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid credentials.");
        return;
      }

      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("tg_user_email", data.user.email);
          window.localStorage.setItem("tg_user_name", data.user.username || "");
          window.localStorage.setItem("tg_user_id", data.user.id || "");
          window.localStorage.setItem("tg_user_avatar_seed", data.user.avatarSeed || "");
          const avatar = data.user.profilePicture || (data.user.id ? `https://api.navii.dev/avatar/${encodeURIComponent(data.user.avatarSeed || data.user.id)}?size=96&tileBg=auto` : "");
          window.localStorage.setItem("tg_user_avatar", avatar);
        }
      } catch {
        // ignore storage errors
      }

      setToast("Signed in successfully.");

      setTimeout(() => {
        setToast(null);
        router.push(redirect);
      }, 900);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-white px-6 text-[#1E1E1E] md:px-10 lg:px-16">
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-[#1E1E1E] px-4 py-3 text-sm text-white shadow-lg shadow-black/20">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#007AFF] text-xs font-semibold">
              ✓
            </span>
            <span>{toast}</span>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-6xl flex-col gap-16 md:flex-row md:items-start md:justify-between">
        {/* Left: Form */}
        <section className="w-full max-w-md space-y-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Welcome Back
            </h1>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Username */}
            <div className="space-y-2">
              <label
                htmlFor="username"
                className="block text-sm font-medium text-[#1E1E1E]"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="block w-full rounded-xl border border-[#E0E0E0] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <label
                  htmlFor="password"
                  className="font-medium text-[#1E1E1E]"
                >
                  Password
                </label>
                <Link
                  href="/signin/forgot-password"
                  className="text-xs font-medium text-[#9E9E9E] hover:text-[#7a7a7a]"
                >
                  Forgot your password?
                </Link>
              </div>
              <PasswordInput
                id="password"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-sm text-[#E33F3F]">{error}</p>
            )}

            <button
              type="submit"
              className="mt-4 flex w-full items-center justify-center rounded-xl bg-[#007AFF] py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0062CC] disabled:cursor-not-allowed disabled:bg-[#9EC8FF]"
              disabled={submitting}
            >
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="pt-2 text-center text-xs text-[#555555]">
            Don&apos;t have an account?{" "}
            <Link href={`/signup${redirect !== "/" ? `?redirect=${encodeURIComponent(redirect)}` : ""}`} className="font-medium text-[#007AFF]">
              Sign Up
            </Link>
          </p>
        </section>

        {/* Right: Benefits / Info */}
        <section className="w-full max-w-md space-y-8 text-sm text-[#1E1E1E]">
          <BenefitItem
            icon={Compass}
            title="Welcome to TertiaryGuide"
            description="Your trusted gateway to a smooth and stress-free admission process, guiding you every step of the way from application to acceptance."
          />
          <BenefitItem
            icon={GraduationCap}
            title="Start Your Admission Journey"
            description="Create an account to unlock personalized insights about tertiary institutions, tailored admission requirements, and programs that best fit your goals."
          />
          <BenefitItem
            icon={Sparkles}
            title="Achieve More, Stress Less"
            description="Streamline your path to educational success with us and move one step closer to your academic goals."
          />
        </section>
      </div>
    </main>
  );
}

type BenefitItemProps = {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

function BenefitItem({ title, description, icon: Icon }: BenefitItemProps) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#007AFF]">
        <Icon className="h-[1.125rem] w-[1.125rem]" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <h3 className="text-sm font-semibold leading-snug text-[#007AFF]">
          {title}
        </h3>
        <p className="text-xs leading-relaxed text-[#555555]">{description}</p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center text-sm text-gray-500">Loading...</div>
      </main>
    }>
      <SignInContent />
    </Suspense>
  );
}
