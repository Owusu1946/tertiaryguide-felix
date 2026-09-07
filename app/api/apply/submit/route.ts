import { NextRequest, NextResponse } from "next/server";
import { ObjectId, type Db } from "mongodb";
import { getDb } from "../../../../lib/mongodb";
import { findSchoolById } from "../../../../lib/admissions/schools";
import type { ApplicationDoc, SchoolDoc } from "../../../../lib/admissions/types";
import {
  applicationsCollection,
  ensureApplicationIndexes,
  generateApplicationNumber,
  parseDocuments,
  parseEducationalBackground,
  parseExaminationInfo,
  parseAdditionalExaminations,
  parseExaminationSittings,
  parseGuardianInfo,
  parsePersonalInfo,
  parseProgrammeChoices,
  parseResults,
  serializeApplication,
} from "../../../../lib/admissions/applications";
import {
  deadlineToIso,
  isApplicationEditable,
  loginWithVoucher,
  markVoucherUsed,
} from "../../../../lib/admissions/vouchers";
import { isDeadlineCalendarExpired } from "../../../../lib/deadlines";
import {
  sendApplicationSubmittedToApplicant,
  sendApplicationSubmittedToSchool,
} from "../../../../lib/email";
import { verifyPassword } from "../../../../lib/password";
import { logPlatformActivity } from "../../../../lib/platform-activity";
import {
  buildApplicationSummaryPdf,
  printoutFilename,
} from "../../../../lib/admissions/application-pdf";
import { printoutFromDetail } from "../../../../lib/admissions/printout-data";
import { schoolApplicationNotifyEmails } from "../../../../lib/admissions/school-notify-emails";
import { listProgrammeChoices } from "../../../../lib/admissions/programme-choices";
import { createUserNotification } from "../../../../lib/user-notifications-server";
import { studentStatusCopy } from "../../../../lib/admissions/status-messages";

async function notifySchoolOfApplication(opts: {
  db: Db;
  school: SchoolDoc;
  application: ApplicationDoc;
  applicantName: string;
  updated: boolean;
}) {
  const emails = await schoolApplicationNotifyEmails(opts.db, opts.school);
  if (emails.length === 0) {
    console.warn(
      "[apply/submit] no school admin emails for",
      opts.school.slug || opts.school.name,
    );
    return;
  }

  const detail = serializeApplication(opts.application);
  const programmes = detail.programmes?.length
    ? detail.programmes
    : listProgrammeChoices(detail.programmeChoices, detail.programme);
  const programme =
    programmes[0]?.display ||
    opts.application.programmeChoices?.firstChoice ||
    null;
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const applicationUrl = `${base}/admin/${opts.school.slug}?tab=applicants&id=${String(opts.application._id)}`;

  let pdf: { filename: string; content: Buffer } | undefined;
  try {
    const content = await buildApplicationSummaryPdf({
      school: {
        name: opts.school.name,
        logoSrc: opts.school.logoSrc,
        brandColor: opts.school.brandColor,
        brandColors: opts.school.brandColors,
        phone: opts.school.phone,
        email: opts.school.email,
        address: opts.school.address,
      },
      data: printoutFromDetail(detail, programmes),
    });
    pdf = {
      filename: printoutFilename(opts.application.applicationNumber),
      content,
    };
  } catch (error) {
    console.error("[apply/submit] school pdf", error);
  }

  for (const to of emails) {
    try {
      await sendApplicationSubmittedToSchool({
        to,
        applicantName: opts.applicantName,
        programme,
        programmes: programmes.map((p) => ({
          label: p.label,
          display: p.display,
        })),
        schoolName: opts.school.name,
        applicationNumber: opts.application.applicationNumber,
        applicationUrl,
        submittedAt: opts.application.submittedAt || new Date(),
        updated: opts.updated,
        pdf,
      });
    } catch (error) {
      console.error("[apply/submit] school email", to, error);
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const schoolId = typeof body?.schoolId === "string" ? body.schoolId : "";
    if (!ObjectId.isValid(schoolId)) {
      return NextResponse.json({ error: "Invalid school id" }, { status: 400 });
    }

    const personalInfo = parsePersonalInfo(body?.personalInfo);
    if (!personalInfo) {
      return NextResponse.json(
        {
          error:
            "Personal information is incomplete (surname, first name, phone, email required)",
        },
        { status: 400 },
      );
    }

    const db = await getDb();
    try {
      await ensureApplicationIndexes(db);
    } catch (indexError) {
      console.error("[apply/submit] indexes", indexError);
    }

    const school = await findSchoolById(db, schoolId);
    if (!school || !school.isPartner || school.isActive === false) {
      return NextResponse.json({ error: "School not available" }, { status: 404 });
    }

    if (isDeadlineCalendarExpired(deadlineToIso(school.deadline))) {
      return NextResponse.json(
        {
          error:
            "The application deadline for this school has passed. You can still view and download your application, but it can no longer be edited.",
        },
        { status: 400 },
      );
    }

    let voucherId: ObjectId | null = null;
    const requiresVoucher = school.requiresVoucher !== false;
    let existingApp: ApplicationDoc | null = null;

    const voucherCode =
      typeof body?.voucherCode === "string" ? body.voucherCode.trim() : "";
    const serialNumber =
      typeof body?.serialNumber === "string" ? body.serialNumber.trim() : "";
    // Also accept PIN / serial aliases from older clients
    const code =
      voucherCode ||
      (typeof body?.pin === "string" ? body.pin.trim() : "") ||
      (typeof body?.voucherPin === "string" ? body.voucherPin.trim() : "");
    const serial =
      serialNumber ||
      (typeof body?.serial === "string" ? body.serial.trim() : "");

    if (requiresVoucher) {
      const validated = await loginWithVoucher({
        db,
        schoolId,
        voucherCode: code,
        serialNumber: serial,
      });
      if (!validated.ok) {
        return NextResponse.json({ error: validated.error }, { status: validated.status });
      }
      voucherId = validated.voucher._id ?? null;
      existingApp = validated.application;
    } else {
      const email =
        typeof body?.loginEmail === "string" ? body.loginEmail.trim().toLowerCase() : "";
      const password = typeof body?.loginPassword === "string" ? body.loginPassword : "";
      if (email && password) {
        const user = await db.collection("users").findOne<{ passwordHash?: string }>({
          email,
        });
        if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
          return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
        }
      }
      if (email) {
        existingApp = await applicationsCollection(db).findOne({
          schoolId: new ObjectId(schoolId),
          applicantEmail: email,
        });
      }
    }

    const formFields = {
      personalInfo,
      guardianInfo: parseGuardianInfo(body?.guardianInfo),
      programmeChoices: parseProgrammeChoices(body?.programmeChoices),
      educationalBackground: parseEducationalBackground(body?.educationalBackground),
      examinationInfo: parseExaminationInfo(body?.examinationInfo),
      additionalExaminations: parseAdditionalExaminations(
        body?.additionalExaminations,
      ),
      examinationSittings: parseExaminationSittings(body?.examinationSittings),
      results: parseResults(body?.results),
      documents: parseDocuments(body?.documents),
      applicantEmail: personalInfo.email,
      updatedAt: new Date(),
    };

    const applicantName = [personalInfo.firstName, personalInfo.surname]
      .filter(Boolean)
      .join(" ");

    if (existingApp?._id) {
      if (!isApplicationEditable(existingApp.status)) {
        return NextResponse.json(
          {
            error: `This application is ${existingApp.status} and can no longer be edited`,
          },
          { status: 400 },
        );
      }

      await applicationsCollection(db).updateOne(
        { _id: existingApp._id },
        { $set: formFields },
      );

      const updated = await applicationsCollection(db).findOne({ _id: existingApp._id });

      if (updated) {
        try {
          await notifySchoolOfApplication({
            db,
            school,
            application: updated,
            applicantName,
            updated: true,
          });
        } catch (e) {
          console.error("[apply/submit] school notify", e);
        }
      }

      await logPlatformActivity({
        req,
        action: "user.application.update",
        surface: "user",
        severity: "info",
        actorKind: "user",
        actorUsername: personalInfo.email,
        actorEmail: personalInfo.email,
        schoolId: String(school._id),
        schoolSlug: school.slug ?? null,
        schoolName: school.name,
        targetType: "application",
        targetId: String(existingApp._id),
        summary: `${applicantName} updated application ${existingApp.applicationNumber} for ${school.name}`,
        success: true,
        meta: { applicationNumber: existingApp.applicationNumber },
      });

      return NextResponse.json({
        ok: true,
        updated: true,
        application: {
          id: String(existingApp._id),
          applicationNumber: existingApp.applicationNumber,
          status: existingApp.status,
          schoolName: school.name,
          submittedAt: existingApp.submittedAt.toISOString(),
          ...(updated ? { detail: serializeApplication(updated) } : {}),
        },
      });
    }

    const now = new Date();
    const applicationNumber = await generateApplicationNumber(db, school.slug || "TG");

    let applicantUserId: ObjectId | null = null;
    const accountEmail =
      typeof body?.accountEmail === "string"
        ? body.accountEmail.trim().toLowerCase()
        : personalInfo.email;
    if (accountEmail) {
      const user = await db.collection("users").findOne<{ _id: ObjectId }>({
        email: accountEmail,
      });
      if (user?._id) applicantUserId = user._id;
    }

    const doc = {
      applicationNumber,
      // Legacy unique index is on `reference`; keep both in sync.
      reference: applicationNumber,
      schoolId: new ObjectId(schoolId),
      applicantUserId,
      voucherId,
      status: "Pending" as const,
      ...formFields,
      submittedAt: now,
      reviewedAt: null,
      reviewedBy: null,
      reviewNotes: null,
    };

    const result = await applicationsCollection(db).insertOne(doc);

    if (voucherId) {
      await markVoucherUsed({
        db,
        voucherId,
        usedBy: personalInfo.email,
      });
    }

    try {
      const programmes = listProgrammeChoices(formFields.programmeChoices);
      await sendApplicationSubmittedToApplicant({
        to: personalInfo.email,
        applicantName,
        schoolName: school.name,
        applicationNumber,
        submittedAt: now,
        programmes: programmes.map((p) => ({
          label: p.label,
          display: p.display,
        })),
      });
    } catch (e) {
      console.error("[apply/submit] applicant email", e);
    }

    try {
      const copy = studentStatusCopy("Pending");
      await createUserNotification(db, {
        email: personalInfo.email,
        title: copy.title,
        body: `${school.name}: ${copy.message} Application number ${applicationNumber}.`,
        kind: "application",
        href: "/dashboard/my-applications",
        dedupeKey: `application-submitted:${String(result.insertedId)}`,
      });
    } catch (e) {
      console.error("[apply/submit] applicant notification", e);
    }

    try {
      await notifySchoolOfApplication({
        db,
        school,
        application: { ...doc, _id: result.insertedId },
        applicantName,
        updated: false,
      });
    } catch (e) {
      console.error("[apply/submit] school notify", e);
    }

    await logPlatformActivity({
      req,
      action: "user.application.submit",
      surface: "user",
      severity: "info",
      actorKind: "user",
      actorUsername: personalInfo.email,
      actorEmail: personalInfo.email,
      schoolId: String(school._id),
      schoolSlug: school.slug ?? null,
      schoolName: school.name,
      targetType: "application",
      targetId: String(result.insertedId),
      summary: `${applicantName} submitted application ${applicationNumber} to ${school.name}`,
      success: true,
      meta: { applicationNumber },
    });

    return NextResponse.json(
      {
        ok: true,
        updated: false,
        application: {
          id: String(result.insertedId),
          applicationNumber,
          status: "Pending",
          schoolName: school.name,
          submittedAt: now.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[apply/submit]", error);
    const duplicate =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000;
    return NextResponse.json(
      {
        error: duplicate
          ? "An application with these details already exists. Log in with your voucher to continue."
          : "Failed to submit application",
      },
      { status: duplicate ? 409 : 500 },
    );
  }
}
