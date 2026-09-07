import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../../../lib/mongodb";
import { requireSchoolPortalAccess } from "../../../../../../lib/admin-access";
import { findSchoolById } from "../../../../../../lib/admissions/schools";
import {
  applicationsCollection,
  isApplicationStatus,
  serializeApplication,
} from "../../../../../../lib/admissions/applications";
import { sendApplicationStatusUpdateToApplicant } from "../../../../../../lib/email";
import { createUserNotification } from "../../../../../../lib/user-notifications-server";
import { studentStatusCopy } from "../../../../../../lib/admissions/status-messages";
import { logPlatformActivity } from "../../../../../../lib/platform-activity";

type Ctx = { params: Promise<{ slug: string; id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { slug, id } = await ctx.params;
  const auth = await requireSchoolPortalAccess(req, slug);
  if ("response" in auth) return auth.response;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid application id" }, { status: 400 });
  }

  const db = await getDb();
  const doc = await applicationsCollection(db).findOne({
    _id: new ObjectId(id),
    schoolId: auth.schoolId,
  });
  if (!doc) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, application: serializeApplication(doc) });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { slug, id } = await ctx.params;
  const auth = await requireSchoolPortalAccess(req, slug);
  if ("response" in auth) return auth.response;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid application id" }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => null);
    const status = body?.status;
    if (!isApplicationStatus(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const reviewNotes =
      typeof body?.reviewNotes === "string" ? body.reviewNotes.trim() : undefined;
    const admittedProgramme =
      typeof body?.admittedProgramme === "string"
        ? body.admittedProgramme.trim()
        : undefined;
    const admittedProgrammeStream =
      typeof body?.admittedProgrammeStream === "string"
        ? body.admittedProgrammeStream.trim()
        : undefined;

    if (status === "Admitted" && !admittedProgramme) {
      return NextResponse.json(
        { error: "Select the programme this student qualifies for before admitting" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const existing = await applicationsCollection(db).findOne({
      _id: new ObjectId(id),
      schoolId: auth.schoolId,
    });
    if (!existing) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    if (
      existing.offerResponse === "accepted" ||
      existing.offerResponse === "declined"
    ) {
      return NextResponse.json(
        {
          error:
            "This student has already responded to the admission offer. Status can no longer be changed.",
        },
        { status: 400 },
      );
    }

    const $set: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy: auth.actor.user.username,
      ...(reviewNotes !== undefined ? { reviewNotes } : {}),
    };

    if (status === "Admitted") {
      $set.admittedProgramme = admittedProgramme;
      $set.admittedProgrammeStream = admittedProgrammeStream || null;
      // Fresh offer — clear any previous student response
      $set.offerResponse = null;
      $set.offerRespondedAt = null;
    }

    await applicationsCollection(db).updateOne(
      { _id: new ObjectId(id), schoolId: auth.schoolId },
      { $set },
    );

    const refreshed = await applicationsCollection(db).findOne({
      _id: new ObjectId(id),
      schoolId: auth.schoolId,
    });
    if (!refreshed) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const serialized = serializeApplication(refreshed);
    const statusChanged = existing.status !== status;
    const programmeForEmail =
      refreshed.admittedProgramme ||
      serialized.programme ||
      null;
    const programmeModeForEmail =
      refreshed.admittedProgrammeStream ||
      serialized.programmes?.[0]?.stream ||
      null;

    if (statusChanged && serialized.email) {
      try {
        const school = await findSchoolById(db, String(auth.schoolId));
        const schoolName = school?.name || "the school";
        await sendApplicationStatusUpdateToApplicant({
          to: serialized.email,
          applicantName: serialized.fullName,
          schoolName,
          applicationNumber: serialized.applicationNumber,
          status,
          programme: programmeForEmail,
          programmeMode: programmeModeForEmail,
          reviewNotes: serialized.reviewNotes,
          decisionDate: refreshed.reviewedAt || new Date(),
        });

        const copy = studentStatusCopy(status);
        const programmeNote = programmeForEmail
          ? ` Programme: ${programmeForEmail}.`
          : "";
        await createUserNotification(db, {
          email: serialized.email,
          title: copy.title,
          body: `${schoolName}: ${copy.message}${programmeNote}`,
          kind: "application",
          href: "/dashboard/my-applications",
          dedupeKey: `application-status:${String(refreshed._id)}:${status}`,
        });
      } catch (emailError) {
        console.error("[school-portal/applications/:id] status email", emailError);
      }
    }

    if (statusChanged) {
      const school = await findSchoolById(db, String(auth.schoolId));
      await logPlatformActivity({
        req,
        action: "partner.application.status_update",
        surface: "partner_school",
        severity: "info",
        actorKind: auth.actor.kind === "staff" ? "staff" : "school_admin",
        actorUsername: auth.actor.user.username,
        actorId: String(auth.actor.user._id),
        schoolId: String(auth.schoolId),
        schoolSlug: school?.slug ?? slug,
        schoolName: school?.name ?? null,
        targetType: "application",
        targetId: id,
        summary: `${auth.actor.user.username} set ${serialized.applicationNumber} to ${status} on ${school?.name || slug}`,
        success: true,
        meta: {
          from: existing.status,
          to: status,
          applicant: serialized.fullName,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      emailed: statusChanged && Boolean(serialized.email),
      application: serialized,
    });
  } catch (error) {
    console.error("[school-portal/applications/:id] PATCH", error);
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 });
  }
}
