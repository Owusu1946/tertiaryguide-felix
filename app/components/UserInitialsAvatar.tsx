"use client";

import React from "react";
import { userAvatarColorClass, userInitials } from "@/lib/user-avatar";

type Props = {
  name?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  title?: string;
};

const SIZE_CLASS: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base sm:h-14 sm:w-14 sm:text-lg",
  xl: "h-24 w-24 text-2xl",
};

export function UserInitialsAvatar({
  name,
  size = "md",
  className = "",
  title,
}: Props) {
  const initials = userInitials(name);
  const colors = userAvatarColorClass(name);

  return (
    <span
      title={title || name || "Profile"}
      aria-label={title || name || "Profile"}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide ring-2 ring-inset ${SIZE_CLASS[size]} ${colors} ${className}`}
    >
      {initials}
    </span>
  );
}
