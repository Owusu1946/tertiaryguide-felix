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

export default function PersonalInfoPage() {
  const [info, setInfo] = useState<PersonalInfo | null>(null);
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
          setInfo({
            id: data.user.id,
            username,
            email: data.user.email ?? storedEmail,
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
    try {
      const email = window.localStorage.getItem("tg_user_email");
      if (!email) return;

      const res = await fetch("/api/user/update-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          username: info.username,
          phone: info.phone,
        }),
      });

      if (res.ok) {
        window.localStorage.setItem("tg_user_name", info.username);
        window.dispatchEvent(new Event("tg_user_name_updated"));
        window.dispatchEvent(new Event("tg-profile-updated"));
        alert("Profile updated successfully!");
      } else {
        alert("Failed to update profile");
      }
    } catch (error) {
      console.error(error);
      alert("Error saving profile");
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
    <>
      <div className="mb-8 flex items-center gap-6">
        {loading && !info?.username ? (
          <div className="h-24 w-24 animate-pulse rounded-full bg-gray-200" />
        ) : (
          <div className="flex flex-col items-center gap-2"><UserAvatar userId={info?.id} avatarSeed={info?.avatarSeed} name={info?.username || info?.email} photoUrl={info?.profilePicture} size="xl" /><div className="flex gap-2"><label className="cursor-pointer rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50">Upload<input type="file" accept="image/*" className="sr-only" disabled={avatarSaving} onChange={(event) => choosePhoto(event.target.files?.[0])} /></label><button type="button" disabled={avatarSaving || !info} onClick={() => void updateAvatar({ avatarSeed: crypto.randomUUID() })} className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50">{avatarSaving ? "Updating..." : "New avatar"}</button></div></div>
        )}
        <div>
          {loading && !info?.username ? (
            <div className="space-y-2">
              <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-semibold leading-tight">
                {info?.username || "User"}
              </h1>
              <p className="text-sm text-[#555555]">{info?.email}</p>
            </>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-semibold leading-tight">Profile</h2>
        <p className="text-sm text-[#555555]">
          Modify your username, phone number, and email
        </p>
      </div>

      <div className="space-y-6 md:max-w-xl">
        <div>
          <label className="mb-1 block text-sm text-gray-600">Username</label>
          <input
            type="text"
            value={usernameValue}
            onChange={(event) =>
              setInfo((prev) => prev ? { ...prev, username: event.target.value } : prev)
            }
            className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3
                    focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
          />
          <p className="mt-1.5 text-xs text-[#6B7280]">
            Use your first and last name so your profile is easy to recognize.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-600">Phone Number</label>
          <input
            type="text"
            value={phoneValue}
            onChange={(event) =>
              setInfo((prev) => prev ? { ...prev, phone: event.target.value } : prev)
            }
            className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3
                    focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-600">Email</label>
          <input
            type="email"
            value={emailValue}
            disabled
            className="w-full cursor-not-allowed rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-gray-500"
          />
        </div>

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={loading || saving || !info}
          className="rounded-full bg-[#007AFF] px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-[#0062CC] disabled:cursor-not-allowed disabled:bg-[#9EC8FF]"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </>
  );
}
