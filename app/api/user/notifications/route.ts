import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";
import {
  createUserNotification,
  deleteUserNotifications,
  listUserNotifications,
  updateUserNotificationRead,
} from "../../../../lib/user-notifications-server";
import type { AppNotificationKind } from "../../../../lib/notifications";

function parseEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function GET(req: NextRequest) {
  try {
    const email = parseEmail(req.nextUrl.searchParams.get("email"));
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const db = await getDb();
    const notifications = await listUserNotifications(db, email);

    return NextResponse.json({
      ok: true,
      notifications,
      unread: notifications.filter((n) => !n.read).length,
    });
  } catch (error) {
    console.error("[user/notifications] GET", error);
    return NextResponse.json(
      { error: "Failed to load notifications" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = parseEmail(body?.email);
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const message = typeof body?.body === "string" ? body.body.trim() : "";
    if (!title || !message) {
      return NextResponse.json(
        { error: "Title and body are required" },
        { status: 400 },
      );
    }

    const kind = (
      typeof body?.kind === "string" ? body.kind : "general"
    ) as AppNotificationKind;

    const db = await getDb();
    const notification = await createUserNotification(db, {
      email,
      title,
      body: message,
      kind,
      href: typeof body?.href === "string" ? body.href : undefined,
      dedupeKey:
        typeof body?.dedupeKey === "string" ? body.dedupeKey : undefined,
    });

    return NextResponse.json({ ok: true, notification });
  } catch (error) {
    console.error("[user/notifications] POST", error);
    return NextResponse.json(
      { error: "Failed to create notification" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = parseEmail(body?.email);
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const action = typeof body?.action === "string" ? body.action : "";
    const db = await getDb();

    let modified = 0;
    if (action === "read_all") {
      modified = await updateUserNotificationRead(db, email, { readAll: true });
    } else if (action === "unread_all") {
      modified = await updateUserNotificationRead(db, email, {
        unreadAll: true,
      });
    } else if (action === "read" || action === "unread") {
      const id = typeof body?.id === "string" ? body.id : "";
      if (!id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      }
      modified = await updateUserNotificationRead(db, email, {
        id,
        read: action === "read",
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const notifications = await listUserNotifications(db, email);
    return NextResponse.json({ ok: true, modified, notifications });
  } catch (error) {
    console.error("[user/notifications] PATCH", error);
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = parseEmail(body?.email);
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const db = await getDb();
    const clearAll = Boolean(body?.clearAll);
    const id = typeof body?.id === "string" ? body.id : undefined;

    const deleted = await deleteUserNotifications(db, email, {
      clearAll,
      id,
    });

    const notifications = clearAll
      ? []
      : await listUserNotifications(db, email);

    return NextResponse.json({ ok: true, deleted, notifications });
  } catch (error) {
    console.error("[user/notifications] DELETE", error);
    return NextResponse.json(
      { error: "Failed to delete notifications" },
      { status: 500 },
    );
  }
}
