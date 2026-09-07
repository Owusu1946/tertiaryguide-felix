import { NextRequest, NextResponse } from "next/server";
import type { ObjectId } from "mongodb";
import { getDb } from "../../../../lib/mongodb";
import { verifyPassword } from "../../../../lib/password";
import { cacheUser, type CachedUser } from "../../../../lib/redis";
import { logPlatformActivity } from "../../../../lib/platform-activity";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      await logPlatformActivity({
        req,
        action: "auth.login.rejected",
        surface: "user",
        severity: "security",
        actorKind: "anonymous",
        actorUsername: username || null,
        summary: "User login rejected: missing credentials",
        success: false,
      });
      return NextResponse.json(
        { error: "Username and password are required" },
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
      role?: string;
    }>({ username });

    if (!userDoc || !userDoc.passwordHash) {
      await logPlatformActivity({
        req,
        action: "auth.login.failed",
        surface: "user",
        severity: "security",
        actorKind: "anonymous",
        actorUsername: username,
        summary: `Failed user login for username "${username}"`,
        success: false,
        meta: { reason: "unknown_user_or_no_password" },
      });
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 400 },
      );
    }

    const valid = await verifyPassword(password, userDoc.passwordHash);

    if (!valid) {
      await logPlatformActivity({
        req,
        action: "auth.login.failed",
        surface: "user",
        severity: "security",
        actorKind: "user",
        actorId: String(userDoc._id),
        actorUsername: userDoc.username || username,
        actorEmail: userDoc.email,
        summary: `Failed user login (bad password) for "${username}"`,
        success: false,
        meta: { reason: "bad_password" },
      });
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 400 },
      );
    }

    await users.updateOne(
      { _id: userDoc._id },
      { $set: { lastLoginAt: new Date() } },
    );

    const cachedUser: CachedUser = {
      id: String(userDoc._id),
      email: userDoc.email,
      username: userDoc.username || "",
      phone: userDoc.phone,
    };

    await cacheUser(cachedUser);

    await logPlatformActivity({
      req,
      action: "auth.login.success",
      surface: "user",
      severity: "info",
      actorKind: "user",
      actorId: cachedUser.id,
      actorUsername: cachedUser.username,
      actorEmail: cachedUser.email,
      summary: `User "${cachedUser.username || cachedUser.email}" signed in`,
      success: true,
    });

    return NextResponse.json(
      {
        ok: true,
        user: cachedUser,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("login error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
