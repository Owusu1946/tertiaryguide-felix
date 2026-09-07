import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../../lib/mongodb";
import {
  nonStaffUserFilter,
  requireStaff,
} from "../../../../../lib/admin-access";
import { invalidateUserCache } from "../../../../../lib/redis";
import { logPlatformActivity } from "../../../../../lib/platform-activity";

const MAX_BATCH_SIZE = 200;

type UserDoc = {
  _id: ObjectId;
  username?: string;
  email?: string;
  phone?: string;
};

export async function POST(req: NextRequest) {
  const auth = await requireStaff(req);
  if ("response" in auth) return auth.response;

  try {
    const body = await req.json().catch(() => null);
    const rawIds = body?.ids;

    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return NextResponse.json(
        { error: "Expected a non-empty ids array." },
        { status: 400 },
      );
    }

    const uniqueIds = [...new Set(rawIds)];
    if (uniqueIds.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `At most ${MAX_BATCH_SIZE} users can be deleted at once.` },
        { status: 400 },
      );
    }

    if (
      uniqueIds.some(
        (id) => typeof id !== "string" || !ObjectId.isValid(id.trim()),
      )
    ) {
      return NextResponse.json(
        { error: "One or more user ids are invalid." },
        { status: 400 },
      );
    }

    const objectIds = uniqueIds.map((id) => new ObjectId(id.trim()));
    const db = await getDb();
    const users = db.collection<UserDoc>("users");
    const targets = await users
      .find({
        _id: { $in: objectIds },
        ...nonStaffUserFilter(),
      })
      .toArray();

    if (targets.length === 0) {
      return NextResponse.json(
        { error: "No matching users were found." },
        { status: 404 },
      );
    }

    const result = await users.deleteMany({
      _id: { $in: targets.map((user) => user._id) },
      ...nonStaffUserFilter(),
    });

    await Promise.all(
      targets
        .filter((user) => user.username && user.email)
        .map((user) =>
          invalidateUserCache({
            id: String(user._id),
            username: user.username!,
            email: user.email!,
            phone: user.phone,
          }),
        ),
    );

    await logPlatformActivity({
      req,
      action: "admin.users.bulk_delete",
      surface: "admin",
      severity: "warning",
      actorKind: "staff",
      actorUsername: auth.user.username,
      actorId: String(auth.user._id),
      actorEmail: auth.user.email || null,
      summary: `Admin "${auth.user.username}" deleted ${result.deletedCount} user account${result.deletedCount === 1 ? "" : "s"}`,
      success: true,
      meta: {
        deletedCount: result.deletedCount,
        emails: targets.map((u) => u.email).filter(Boolean).slice(0, 50),
      },
    });

    return NextResponse.json({
      ok: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("[admin/users/bulk-delete] POST error", error);
    return NextResponse.json(
      { error: "Failed to delete users." },
      { status: 500 },
    );
  }
}
