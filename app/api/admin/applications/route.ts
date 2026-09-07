import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../lib/mongodb";
import { requireStaff } from "../../../../lib/admin-access";
import {
  applicationsCollection,
  ensureApplicationIndexes,
  serializeApplication,
} from "../../../../lib/admissions/applications";
import { softDeleteApplications } from "../../../../lib/admissions/deleted-applications";
import { schoolsCollection } from "../../../../lib/admissions/schools";
import { logPlatformActivity } from "../../../../lib/platform-activity";

export async function GET(req: NextRequest) {
  const auth = await requireStaff(req);
  if ("response" in auth) return auth.response;

  try {
    const db = await getDb();
    await ensureApplicationIndexes(db);

    const docs = await applicationsCollection(db)
      .find({})
      .sort({ submittedAt: -1 })
      .limit(500)
      .toArray();

    const schoolObjectIds = [
      ...new Map(
        docs
          .map((doc) => doc.schoolId)
          .filter((id): id is ObjectId => Boolean(id))
          .map((id) => [String(id), id instanceof ObjectId ? id : new ObjectId(String(id))]),
      ).values(),
    ];

    const schoolDocs =
      schoolObjectIds.length > 0
        ? await schoolsCollection(db)
            .find({ _id: { $in: schoolObjectIds } })
            .toArray()
        : [];

    const schoolMap = Object.fromEntries(
      schoolDocs.map((school) => [
        String(school._id),
        { name: school.name, slug: school.slug ?? null },
      ]),
    );

    const applications = docs.map((doc) => {
      const serialized = serializeApplication(doc);
      const school = schoolMap[serialized.schoolId] || {
        name: "Unknown school",
        slug: null,
      };
      return {
        ...serialized,
        schoolName: school.name,
        schoolSlug: school.slug,
      };
    });

    return NextResponse.json({ ok: true, applications });
  } catch (error) {
    console.error("[admin/applications] GET", error);
    return NextResponse.json(
      { error: "Failed to load applications" },
      { status: 500 },
    );
  }
}

/**
 * Soft-delete partner applications from the main admin Applications view.
 * Backups go to deletedApplications (restoreable under Deleted apps).
 */
export async function DELETE(req: NextRequest) {
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
        { error: "Select at least one application to delete" },
        { status: 400 },
      );
    }
    if (ids.length > 100) {
      return NextResponse.json(
        { error: "You can delete at most 100 applications at once" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const docs = await applicationsCollection(db)
      .find({ _id: { $in: ids } })
      .toArray();

    if (docs.length === 0) {
      return NextResponse.json({
        ok: true,
        deletedCount: 0,
        deletedIds: [],
        message: "No matching applications were found to delete.",
      });
    }

    const bySchool = new Map<string, ObjectId[]>();
    for (const doc of docs) {
      const schoolKey = String(doc.schoolId);
      const list = bySchool.get(schoolKey) || [];
      list.push(doc._id as ObjectId);
      bySchool.set(schoolKey, list);
    }

    const schoolObjectIds = [...bySchool.keys()]
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));
    const schoolDocs =
      schoolObjectIds.length > 0
        ? await schoolsCollection(db)
            .find({ _id: { $in: schoolObjectIds } })
            .toArray()
        : [];
    const schoolMap = Object.fromEntries(
      schoolDocs.map((school) => [
        String(school._id),
        { name: school.name, slug: school.slug ?? null },
      ]),
    );

    const deletedBy = auth.user.username;
    let deletedCount = 0;
    const deletedIds: string[] = [];

    for (const [schoolIdStr, applicationIds] of bySchool) {
      if (!ObjectId.isValid(schoolIdStr)) continue;
      const school = schoolMap[schoolIdStr];
      const result = await softDeleteApplications({
        db,
        schoolId: new ObjectId(schoolIdStr),
        applicationIds,
        deletedBy,
        deletedByKind: "platform",
        schoolSlug: school?.slug ?? null,
        schoolName: school?.name ?? null,
      });
      deletedCount += result.deletedCount;
      deletedIds.push(...result.deletedIds);
    }

    await logPlatformActivity({
      req,
      action: "admin.applications.delete",
      surface: "admin",
      severity: "warning",
      actorKind: "staff",
      actorUsername: auth.user.username,
      actorId: String(auth.user._id),
      actorEmail: auth.user.email || null,
      summary:
        deletedCount === 0
          ? `Admin "${auth.user.username}" attempted application delete (none matched)`
          : `Admin "${auth.user.username}" deleted ${deletedCount} application${deletedCount === 1 ? "" : "s"}`,
      success: deletedCount > 0,
      meta: { deletedCount, deletedIds },
    });

    return NextResponse.json({
      ok: true,
      deletedCount,
      deletedIds,
      message:
        deletedCount === 0
          ? "No matching applications were found to delete."
          : `${deletedCount} application${deletedCount === 1 ? "" : "s"} removed. You can restore them from Deleted apps.`,
    });
  } catch (error) {
    console.error("[admin/applications] DELETE", error);
    return NextResponse.json(
      { error: "Could not delete applications. Please try again." },
      { status: 500 },
    );
  }
}
