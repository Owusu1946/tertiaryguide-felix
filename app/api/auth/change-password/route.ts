import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../lib/mongodb";
import { verifyPassword, hashPassword } from "../../../../lib/password";
import { cacheUser, type CachedUser } from "../../../../lib/redis";
import { logPlatformActivity } from "../../../../lib/platform-activity";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, currentPassword, newPassword } = body as {
      email?: string;
      currentPassword?: string;
      newPassword?: string;
    };

    if (!email || !currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const users = db.collection("users");

    const userDoc = await users.findOne<{
      _id: ObjectId;
      email: string;
      username?: string;
      phone?: string;
      passwordHash?: string;
    }>({ email: email.toLowerCase() });

    if (!userDoc || !userDoc.passwordHash) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 400 },
      );
    }

    const valid = await verifyPassword(currentPassword, userDoc.passwordHash);
    if (!valid) {
      await logPlatformActivity({
        req,
        action: "auth.password_change.failed",
        surface: "user",
        severity: "security",
        actorKind: "user",
        actorId: String(userDoc._id),
        actorUsername: userDoc.username || null,
        actorEmail: userDoc.email,
        summary: `Failed password change for ${userDoc.email}`,
        success: false,
        meta: { reason: "bad_current_password" },
      });
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 400 },
      );
    }

    const newHash = await hashPassword(newPassword);
    await users.updateOne(
      { _id: userDoc._id },
      { $set: { passwordHash: newHash, updatedAt: new Date() } },
    );

    await logPlatformActivity({
      req,
      action: "auth.password_change.success",
      surface: "user",
      severity: "security",
      actorKind: "user",
      actorId: String(userDoc._id),
      actorUsername: userDoc.username || null,
      actorEmail: userDoc.email,
      summary: `Password changed for ${userDoc.username || userDoc.email}`,
      success: true,
    });

    const cachedUser: CachedUser = {
      id: String(userDoc._id),
      email: userDoc.email,
      username: userDoc.username || "",
      phone: userDoc.phone,
    };
    await cacheUser(cachedUser);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("change-password error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
