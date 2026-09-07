import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../../lib/mongodb";
import { requireSchoolPortalAccess } from "../../../../../lib/admin-access";
import { findSchoolById } from "../../../../../lib/admissions/schools";
import {
  applicationsCollection,
  ensureApplicationIndexes,
  isApplicationStatus,
  serializeApplication,
} from "../../../../../lib/admissions/applications";
import { softDeleteApplications } from "../../../../../lib/admissions/deleted-applications";
import { logPlatformActivity } from "../../../../../lib/platform-activity";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  const auth = await requireSchoolPortalAccess(req, slug);
  if ("response" in auth) return auth.response;

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const limit = Math.min(Number(url.searchParams.get("limit") || 100) || 100, 500);

    const db = await getDb();
    await ensureApplicationIndexes(db);

    const filter: Record<string, unknown> = { schoolId: auth.schoolId };
    const offerResponse = url.searchParams.get("offerResponse");
    if (offerResponse === "accepted" || offerResponse === "declined") {
      filter.status = "Admitted";
      filter.offerResponse = offerResponse;
    } else if (offerResponse === "pending") {
      filter.status = "Admitted";
      filter.$or = [
        { offerResponse: null },
        { offerResponse: { $exists: false } },
      ];
    } else {
      // Main Applicants list: exclude students who already accepted or declined
      filter.$nor = [
        { status: "Admitted", offerResponse: "accepted" },
        { status: "Admitted", offerResponse: "declined" },
      ];
      if (status && isApplicationStatus(status)) {
        filter.status = status;
      }
    }

    const docs = await applicationsCollection(db)
      .find(filter)
      .sort({ submittedAt: -1 })
      .limit(limit)
      .toArray();

    let applications = docs.map(serializeApplication);
    if (q) {
      applications = applications.filter((a) => {
        const hay = `${a.fullName} ${a.email} ${a.phone ?? ""} ${a.applicationNumber} ${a.programme ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    return NextResponse.json({ ok: true, applications });
  } catch (error) {
    console.error("[school-portal/applications] GET", error);
    return NextResponse.json({ error: "Failed to load applications" }, { status: 500 });
  }
}

/**
 * Soft-delete selected applications for this partner school.
 * Backups go to deletedApplications for TertiaryGuide platform restore.
 */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  const auth = await requireSchoolPortalAccess(req, slug);
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
        { error: "Select at least one applicant to delete" },
        { status: 400 },
      );
    }
    if (ids.length > 100) {
      return NextResponse.json(
        { error: "You can delete at most 100 applicants at once" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const school = await findSchoolById(db, String(auth.schoolId));
    const deletedBy = auth.actor.user.username;

    const result = await softDeleteApplications({
      db,
      schoolId: auth.schoolId,
      applicationIds: ids,
      deletedBy,
      deletedByKind: auth.actor.kind === "staff" ? "platform" : "school_admin",
      schoolSlug: school?.slug ?? slug,
      schoolName: school?.name ?? null,
    });

    await logPlatformActivity({
      req,
      action: "partner.applications.delete",
      surface: "partner_school",
      severity: "warning",
      actorKind: auth.actor.kind === "staff" ? "staff" : "school_admin",
      actorUsername: deletedBy,
      actorId: String(auth.actor.user._id),
      schoolId: String(auth.schoolId),
      schoolSlug: school?.slug ?? slug,
      schoolName: school?.name ?? null,
      summary:
        result.deletedCount === 0
          ? `${deletedBy} attempted applicant delete on ${school?.name || slug} (none matched)`
          : `${deletedBy} deleted ${result.deletedCount} applicant${result.deletedCount === 1 ? "" : "s"} on ${school?.name || slug}`,
      success: result.deletedCount > 0,
      meta: {
        deletedCount: result.deletedCount,
        deletedIds: result.deletedIds,
      },
    });

    return NextResponse.json({
      ok: true,
      deletedCount: result.deletedCount,
      deletedIds: result.deletedIds,
      message:
        result.deletedCount === 0
          ? "No matching applicants were found to delete."
          : `${result.deletedCount} applicant${result.deletedCount === 1 ? "" : "s"} removed from your portal. TertiaryGuide keeps a recoverable backup.`,
    });
  } catch (error) {
    console.error("[school-portal/applications] DELETE", error);
    return NextResponse.json(
      { error: "Could not delete applicants. Please try again." },
      { status: 500 },
    );
  }
}
