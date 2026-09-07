export type AppNotificationKind =
  | "voucher"
  | "checker"
  | "news"
  | "explore"
  | "email"
  | "application"
  | "general";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  href?: string;
  kind?: AppNotificationKind;
};

export type AdminNotification = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  section?: string;
};

export const USER_NOTIFICATIONS_UPDATED = "tg-notifications-updated";
export const ADMIN_NOTIFICATIONS_UPDATED = "tg-admin-notifications-updated";
export const ADMIN_NOTIFICATIONS_KEY = "tg_admin_notifications";

export function userNotificationsKey(email: string) {
  return `tg_notifications:${email.trim().toLowerCase()}`;
}

export function parseNotificationList<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function readUserNotifications(email: string): AppNotification[] {
  if (typeof window === "undefined") return [];
  return parseNotificationList<AppNotification>(
    window.localStorage.getItem(userNotificationsKey(email)),
  );
}

export function writeUserNotifications(
  email: string,
  items: AppNotification[],
  opts?: { silent?: boolean },
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    userNotificationsKey(email),
    JSON.stringify(items.slice(0, 80)),
  );
  if (!opts?.silent) {
    window.dispatchEvent(new CustomEvent(USER_NOTIFICATIONS_UPDATED));
  }
}

export function resolveNotificationHref(n: AppNotification): string {
  if (n.href) return n.href;
  if (n.kind === "checker") return "/dashboard/my-checkers";
  if (n.kind === "voucher") return "/dashboard/my-forms";
  if (n.kind === "application") return "/dashboard/my-applications";
  if (n.kind === "news") return "/blog";
  if (n.kind === "explore") return "/explore";
  if (n.kind === "email") return "/dashboard/notification";

  const haystack = `${n.id} ${n.title} ${n.body}`.toLowerCase();
  if (haystack.includes("wassce") || haystack.includes("checker")) {
    return "/dashboard/my-checkers";
  }
  if (haystack.includes("application")) {
    return "/dashboard/my-applications";
  }
  if (haystack.includes("explore")) {
    return "/explore";
  }
  if (
    haystack.includes("voucher") ||
    haystack.includes("form") ||
    haystack.includes("queued")
  ) {
    return "/dashboard/my-forms";
  }
  if (
    haystack.includes("news") ||
    haystack.includes("blog") ||
    haystack.includes("announcement")
  ) {
    return "/blog";
  }
  if (haystack.includes("email") || haystack.includes("campaign")) {
    return "/dashboard/notification";
  }
  return "/dashboard/notification";
}

export function resolveAdminNotificationSection(n: AdminNotification): string {
  if (
    n.section === "forms" ||
    n.section === "checkers" ||
    n.section === "applications" ||
    n.section === "assistance" ||
    n.section === "formRequests"
  ) {
    return n.section;
  }

  const haystack = `${n.id} ${n.title} ${n.body}`.toLowerCase();
  if (haystack.includes("wassce") || haystack.includes("checker")) {
    return "checkers";
  }
  if (haystack.includes("assistance") || haystack.includes("support")) {
    return "assistance";
  }
  if (haystack.includes("application")) {
    return "applications";
  }
  if (haystack.includes("request")) {
    return "formRequests";
  }
  if (haystack.includes("voucher") || haystack.includes("form")) {
    return "forms";
  }
  return "dashboard";
}

export function unreadCount(items: { read: boolean }[]) {
  return items.filter((n) => !n.read).length;
}

/** Merge server notifications with any local-only items; server wins on id clash. */
export function mergeNotificationLists(
  server: AppNotification[],
  local: AppNotification[],
): AppNotification[] {
  const byId = new Map<string, AppNotification>();
  for (const item of local) {
    byId.set(item.id, item);
  }
  for (const item of server) {
    byId.set(item.id, item);
  }
  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function fetchServerNotifications(
  email: string,
): Promise<AppNotification[]> {
  const res = await fetch(
    `/api/user/notifications?email=${encodeURIComponent(email)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.notifications) ? data.notifications : [];
}

export async function pushServerNotification(input: {
  email: string;
  title: string;
  body: string;
  kind?: AppNotificationKind;
  href?: string;
  dedupeKey?: string;
}): Promise<AppNotification | null> {
  try {
    const res = await fetch("/api/user/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.notification as AppNotification) || null;
  } catch {
    return null;
  }
}

export async function patchServerNotification(input: {
  email: string;
  action: "read" | "unread" | "read_all" | "unread_all";
  id?: string;
}): Promise<AppNotification[] | null> {
  try {
    const res = await fetch("/api/user/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.notifications) ? data.notifications : null;
  } catch {
    return null;
  }
}

export async function deleteServerNotification(input: {
  email: string;
  id?: string;
  clearAll?: boolean;
}): Promise<AppNotification[] | null> {
  try {
    const res = await fetch("/api/user/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.notifications) ? data.notifications : null;
  } catch {
    return null;
  }
}

export function isMongoNotificationId(id: string) {
  return /^[a-f\d]{24}$/i.test(id);
}
