import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";
import { hashPassword } from "../../../../lib/password";
import { sendWelcomeEmail } from "../../../../lib/email";
import { logPlatformActivity } from "../../../../lib/platform-activity";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, email, phone, password } = body as {
      username?: string;
      email?: string;
      phone?: string;
      password?: string;
    };

    if (!username || !email || !phone || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const users = db.collection("users");

    const existingByEmail = await users.findOne({ email: email.toLowerCase() });
    if (existingByEmail) {
      await logPlatformActivity({
        req,
        action: "auth.signup.conflict",
        surface: "user",
        severity: "warning",
        actorKind: "anonymous",
        actorUsername: username,
        actorEmail: email.toLowerCase(),
        summary: `Signup blocked: email already exists (${email.toLowerCase()})`,
        success: false,
        meta: { reason: "email_exists" },
      });
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    const existingByUsername = await users.findOne({ username });
    if (existingByUsername) {
      await logPlatformActivity({
        req,
        action: "auth.signup.conflict",
        surface: "user",
        severity: "warning",
        actorKind: "anonymous",
        actorUsername: username,
        actorEmail: email.toLowerCase(),
        summary: `Signup blocked: username already taken (${username})`,
        success: false,
        meta: { reason: "username_exists" },
      });
      return NextResponse.json(
        { error: "This username is already taken" },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);

    const now = new Date();
    const insertResult = await users.insertOne({
      username,
      email: email.toLowerCase(),
      phone,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    });

    try {
      await sendWelcomeEmail({
        to: email.toLowerCase(),
        username,
      });
    } catch (error) {
      console.error("[signup] welcome email failed", error);
    }

    await logPlatformActivity({
      req,
      action: "auth.signup.success",
      surface: "user",
      severity: "info",
      actorKind: "user",
      actorId: String(insertResult.insertedId),
      actorUsername: username,
      actorEmail: email.toLowerCase(),
      summary: `New user account created: ${username}`,
      success: true,
    });

    return NextResponse.json(
      {
        ok: true,
        userId: insertResult.insertedId,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Signup error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
