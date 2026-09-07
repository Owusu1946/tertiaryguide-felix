import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../lib/mongodb";
import { requireStaff } from "../../../../lib/admin-access";
import {
  deletedApplicationsCollection,
  ensureDeletedApplicationIndexes,
  restoreDeletedApplications,
  serializeDeletedApplication,
} from "../../../../lib/admissions/deleted-applications";

/** List soft-deleted partner applications (platform backup). */
export async function GET(req: NextRequest) {
  const auth = await requireStaff(req);
  if ("response" in auth) return auth.response;

  try {
    const db = await getDb();
    await ensureDeletedApplicationIndexes(db);

    const docs = await deletedApplicationsCollection(db)
      .find({})
      .sort({ deletedAt: -1 })
      .limit(500)
      .toArray();

    return NextResponse.json({
      ok: true,
      applications: docs.map(serializeDeletedApplication),
    });
  } catch (error) {
    console.error("[admin/deleted-applications] GET", error);
    return NextResponse.json(
      { error: "Failed to load deleted applications" },
      { status: 500 },
    );
  }
}

/** Restore soft-deleted applications back to the partner school portal. */
export async function POST(req: NextRequest) {
  const auth = await requireStaff(req);
  if ("response" in auth) return auth.response;

  try {
    const body = await req.json().catch(() => null);
    const rawIds = Array.isArray(body?.ids) ? body.ids : [];
    const ids = rawIds
      .filter((id: unknown): id is string => typeof id === "string")
      .filter((id: string) => ObjectId.isValid(id))
      .map((id: string) => new ObjectId(id));

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Select at least one deleted application to restore" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const result = await restoreDeletedApplications({ db, deletedIds: ids });

    return NextResponse.json({
      ok: true,
      restoredCount: result.restoredCount,
      restoredIds: result.restoredIds,
      errors: result.errors,
      message:
        result.restoredCount === 0
          ? "Nothing was restored."
          : `${result.restoredCount} application${result.restoredCount === 1 ? "" : "s"} restored to the partner school portal.`,
    });
  } catch (error) {
    console.error("[admin/deleted-applications] POST", error);
    return NextResponse.json(
      { error: "Failed to restore applications" },
      { status: 500 },
    );
  }
}
