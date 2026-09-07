const AVATAR_COLORS = [
  "bg-[#DBEAFE] text-[#1D4ED8] ring-[#BFDBFE]",
  "bg-[#FCE7F3] text-[#BE185D] ring-[#FBCFE8]",
  "bg-[#DCFCE7] text-[#15803D] ring-[#BBF7D0]",
  "bg-[#FEF3C7] text-[#B45309] ring-[#FDE68A]",
  "bg-[#EDE9FE] text-[#6D28D9] ring-[#DDD6FE]",
  "bg-[#CFFAFE] text-[#0E7490] ring-[#A5F3FC]",
  "bg-[#FFEDD5] text-[#C2410C] ring-[#FED7AA]",
  "bg-[#E0E7FF] text-[#4338CA] ring-[#C7D2FE]",
] as const;

/** "Felix Owusu" → "FO", "felix" → "FE", "a@b.com" → "AB" */
export function userInitials(nameOrEmail?: string | null): string {
  const raw = (nameOrEmail || "").trim();
  if (!raw) return "?";

  const withoutEmailDomain = raw.includes("@") ? raw.split("@")[0] : raw;
  const parts = withoutEmailDomain
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    const first = parts[0][0] || "";
    const second = parts[1][0] || "";
    return `${first}${second}`.toUpperCase();
  }

  const single = parts[0] || "?";
  return single.slice(0, 2).toUpperCase();
}

export function userAvatarColorClass(seed?: string | null): string {
  const source = (seed || "user").trim() || "user";
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
