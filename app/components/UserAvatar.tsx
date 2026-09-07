"use client";

import Image from "next/image";
import { UserInitialsAvatar } from "./UserInitialsAvatar";

type Props = { userId?: string | null; avatarSeed?: string | null; name?: string | null; photoUrl?: string | null; size?: "sm" | "md" | "lg" | "xl"; className?: string };
const SIZE: Record<NonNullable<Props["size"]>, { px: number; className: string }> = { sm: { px: 32, className: "h-8 w-8" }, md: { px: 40, className: "h-10 w-10" }, lg: { px: 56, className: "h-14 w-14" }, xl: { px: 96, className: "h-24 w-24" } };

export function UserAvatar({ userId, avatarSeed, name, photoUrl, size = "md", className = "" }: Props) {
  const config = SIZE[size];
  const seed = avatarSeed || userId;
  const navii = seed ? `https://api.navii.dev/avatar/${encodeURIComponent(seed)}?size=${config.px}&tileBg=auto` : null;
  const src = photoUrl || navii;
  if (!src) return <UserInitialsAvatar name={name} size={size} className={className} />;
  return <Image src={src} alt={name || "Profile"} width={config.px} height={config.px} unoptimized className={`${config.className} shrink-0 rounded-full object-cover ${className}`} />;
}
