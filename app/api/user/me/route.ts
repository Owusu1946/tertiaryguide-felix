import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";
import {
  cacheUser,
  getCachedUserByEmail,
  type CachedUser,
} from "../../../../lib/redis";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    // 1. Try Redis cache
    const cached = await getCachedUserByEmail(email);
    if (cached) {
      return NextResponse.json({ ok: true, user: cached }, { status: 200 });
    }

    // 2. Fallback to MongoDB
    const db = await getDb();
    const users = db.collection("users");

    const doc = await users.findOne<{ _id: unknown; username?: string; email?: string; phone?: string; profilePicture?: string | null; avatarSeed?: string | null }>(
      { email: email.toLowerCase() },
      { projection: { username: 1, email: 1, phone: 1, profilePicture: 1, avatarSeed: 1 } },
    );

    if (!doc || !doc.email) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user: CachedUser = {
      id: String(doc._id),
      username: doc.username || "",
      email: doc.email,
      phone: doc.phone,
      profilePicture: doc.profilePicture ?? null,
      avatarSeed: doc.avatarSeed ?? null,
    };

    await cacheUser(user);

    return NextResponse.json({ ok: true, user }, { status: 200 });
  } catch (error) {
    console.error("/api/user/me error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
