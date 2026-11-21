"use client";

import React, { useEffect, useState } from "react";
import { UserAvatar } from "@/app/components/UserAvatar";

type PersonalInfo = {
  id: string;
  username: string;
  email: string;
  phone?: string;
  profilePicture?: string | null;
  avatarSeed?: string | null;
};

const inputClass =
  "w-full min-w-0 rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-[#0F172A] outline-none transition placeholder:text-[#94A3B8] focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 sm:text-sm";

export default function PersonalInfoPage() {
  const [info, setInfo] = useState<PersonalInfo | null>(null);
  const [accountEmail, setAccountEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);

  useEffect(() => {
    const storedEmail =
      typeof window !== "undefined"
        ? window.localStorage.getItem("tg_user_email")
        : null;

    if (!storedEmail) {
      setLoading(false);
      return;
    }

    setAccountEmail(storedEmail.trim().toLowerCase());
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(
          `/api/user/me?email=${encodeURIComponent(storedEmail)}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (data?.user) {
          const username = data.user.username ?? "";
          const email = (data.user.email ?? storedEmail).trim().toLowerCase();
          setAccountEmail(email);
          setInfo({
            id: data.user.id,
            username,
            email,
            phone: data.user.phone ?? "",
            profilePicture: data.user.profilePicture ?? null,
            avatarSeed: data.user.avatarSeed ?? null,
          });
          if (username) {
            window.localStorage.setItem("tg_user_name", username);
            window.dispatchEvent(new Event("tg_user_name_updated"));
          }
        }
      } catch {
        // ignore fetch errors for now
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, []);

  const handleSave = async () => {
    if (!info) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const currentEmail =
        accountEmail ||
        window.localStorage.getItem("tg_user_email")?.trim().toLowerCase() ||
        "";
      if (!currentEmail) {
        setError("Could not find your account email. Please sign in again.");
        return;
      }

      const nextEmail = info.email.trim().toLowerCase();
      if (!nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
        setError("Enter a valid email address.");
        return;
      }

      const res = await fetch("/api/user/update-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: currentEmail,
          newEmail: nextEmail,
          username: info.username,
          phone: info.phone,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Failed to update profile",
        );
      }

      const savedEmail =
        typeof data.email === "string"
          ? data.email.trim().toLowerCase()
          : nextEmail;

      window.localStorage.setItem("tg_user_email", savedEmail);
      window.localStorage.setItem("tg_user_name", info.username);
      setAccountEmail(savedEmail);
      setInfo((prev) =>
        prev
          ? {
              ...prev,
              email: savedEmail,
            }
          : prev,
      );
      window.dispatchEvent(new Event("tg_user_name_updated"));
      window.dispatchEvent(new Event("tg-profile-updated"));
      setMessage(
        data.emailChanged
          ? "Profile updated. Your email was changed successfully."
          : "Profile updated successfully.",
      );
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Error saving profile",
      );
    } finally {
      setSaving(false);
    }
  };

  const usernameValue = loading ? "" : info?.username ?? "";
  const emailValue = loading ? "" : info?.email ?? "";
  const phoneValue = loading ? "" : info?.phone ?? "";

  const updateAvatar = async (payload: { image?: string; avatarSeed?: string }) => {
    if (!info) return;
    const email = window.localStorage.getItem("tg_user_email");
    if (!email) return;
    setAvatarSaving(true);
    try {
      const res = await fetch("/api/user/profile-picture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, ...payload }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update profile photo");
      const next = { ...info, profilePicture: data.profilePicture ?? null, avatarSeed: data.avatarSeed ?? null };
      setInfo(next);
      const avatarUrl = next.profilePicture || `https://api.navii.dev/avatar/${encodeURIComponent(next.avatarSeed || next.id)}?size=96&tileBg=auto`;
      window.localStorage.setItem("tg_user_avatar", avatarUrl);
      window.localStorage.setItem("tg_user_id", next.id);
      window.localStorage.setItem("tg_user_avatar_seed", next.avatarSeed || "");
      window.dispatchEvent(new Event("tg-profile-updated"));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not update profile photo");
    } finally {
      setAvatarSaving(false);
    }
  };

  const choosePhoto = (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Please choose an image under 2MB."); return; }
    const reader = new FileReader();
    reader.onload = () => void updateAvatar({ image: String(reader.result || "") });
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-5">
        {loading && !info?.username ? (
          <div className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-gray-200 sm:h-24 sm:w-24" />
        ) : (
          <div className="flex flex-col items-center gap-2"><UserAvatar userId={info?.id} avatarSeed={info?.avatarSeed} name={info?.username || info?.email} photoUrl={info?.profilePicture} size="xl" /><div className="flex gap-2"><label className="cursor-pointer rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50">Upload<input type="file" accept="image/*" className="sr-only" disabled={avatarSaving} onChange={(event) => choosePhoto(event.target.files?.[0])} /></label><button type="button" disabled={avatarSaving || !info} onClick={() => void updateAvatar({ avatarSeed: crypto.randomUUID() })} className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50">{avatarSaving ? "Updating..." : "New avatar"}</button></div></div>
        )}
        <div className="min-w-0 flex-1">
          {loading && !info?.username ? (
            <div className="space-y-2">
              <div className="h-7 w-40 max-w-full animate-pulse rounded bg-gray-200 sm:h-8 sm:w-48" />
              <div className="h-4 w-48 max-w-full animate-pulse rounded bg-gray-200" />
            </div>
          ) : (
            <>
              <h1 className="truncate text-xl font-semibold leading-tight text-[#1E1E1E] sm:text-3xl">
                {info?.username || "User"}
              </h1>
              <p className="mt-1 break-all text-sm leading-snug text-[#555555] sm:break-words">
                {info?.email}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-semibold leading-tight text-[#1E1E1E]">
          Profile
        </h2>
        <p className="text-sm text-[#555555]">
          Modify your username, phone number, and email
        </p>
      </div>

      <div className="space-y-5 sm:max-w-xl sm:space-y-6">
        <div>
          <label
            htmlFor="profile-username"
            className="mb-1.5 block text-sm font-medium text-[#374151]"
          >
            Username
          </label>
          <input
            id="profile-username"
            type="text"
            autoComplete="name"
            value={usernameValue}
            onChange={(event) =>
              setInfo((prev) => prev ? { ...prev, username: event.target.value } : prev)
            }
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-[#6B7280]">
            Use your first and last name so your profile is easy to recognize.
          </p>
        </div>

        <div>
          <label
            htmlFor="profile-phone"
            className="mb-1.5 block text-sm font-medium text-[#374151]"
          >
            Phone Number
          </label>
          <input
            id="profile-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phoneValue}
            onChange={(event) =>
              setInfo((prev) => prev ? { ...prev, phone: event.target.value } : prev)
            }
            className={inputClass}
            placeholder="Optional"
          />
        </div>

        <div>
          <label
            htmlFor="profile-email"
            className="mb-1.5 block text-sm font-medium text-[#374151]"
          >
            Email
          </label>
          <input
            id="profile-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={emailValue}
            onChange={(event) =>
              setInfo((prev) => ({
                username: prev?.username ?? "",
                email: event.target.value,
                phone: prev?.phone ?? "",
              }))
            }
            className={inputClass}
          />
          <p className="mt-1.5 text-xs leading-relaxed text-[#6B7280]">
            This email is used for sign-in and for your forms, vouchers, and
            notifications.
          </p>
        </div>

        {error ? (
          <div
            className="rounded-2xl border border-red-100 bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]"
            role="alert"
          >
            {error}
          </div>
        ) : null}
        {message ? (
          <div
            className="rounded-2xl border border-green-100 bg-[#F0FDF4] px-4 py-3 text-sm text-[#166534]"
            role="status"
          >
            {message}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={loading || saving || !info}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#007AFF] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0062CC] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#9EC8FF] disabled:active:scale-100 sm:h-auto sm:w-auto sm:py-3"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
