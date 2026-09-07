import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";
import {
  getCachedUserByEmail,
  invalidateUserCache,
} from "../../../../lib/redis";
import { logPlatformActivity } from "../../../../lib/platform-activity";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body as { email?: string };

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const users = db.collection("users");
    const normalizedEmail = email.toLowerCase();
    const existing = await users.findOne<{
      username?: string;
      email: string;
    }>({ email: normalizedEmail });

    const result = await users.deleteOne({ email: normalizedEmail });

    if (result.deletedCount === 0) {
      await logPlatformActivity({
        req,
        action: "auth.account_delete.failed",
        surface: "user",
        severity: "warning",
        actorKind: "anonymous",
        actorEmail: normalizedEmail,
        summary: `Account delete failed: not found (${normalizedEmail})`,
        success: false,
      });
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 },
      );
    }

    const cached = await getCachedUserByEmail(email);
    if (cached) {
      await invalidateUserCache(cached);
    }

    await logPlatformActivity({
      req,
      action: "auth.account_delete.success",
      surface: "user",
      severity: "warning",
      actorKind: "user",
      actorUsername: existing?.username || null,
      actorEmail: normalizedEmail,
      summary: `User account deleted: ${existing?.username || normalizedEmail}`,
      success: true,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("delete-account error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
