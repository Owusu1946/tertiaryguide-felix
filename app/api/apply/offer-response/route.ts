import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../lib/mongodb";
import {
  applicationsCollection,
  serializeApplication,
} from "../../../../lib/admissions/applications";

/**
 * Student accepts or declines an admission offer.
 * Body: { applicationId, email, response: "accepted" | "declined" }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const applicationId =
      typeof body?.applicationId === "string" ? body.applicationId.trim() : "";
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const response = body?.response;

    if (!ObjectId.isValid(applicationId)) {
      return NextResponse.json({ error: "Invalid application id" }, { status: 400 });
    }
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (response !== "accepted" && response !== "declined") {
      return NextResponse.json(
        { error: "Response must be accepted or declined" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const app = await applicationsCollection(db).findOne({
      _id: new ObjectId(applicationId),
    });
    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const applicantEmail = (
      app.applicantEmail ||
      app.personalInfo?.email ||
      ""
    )
      .trim()
      .toLowerCase();
    if (applicantEmail !== email) {
      return NextResponse.json(
        { error: "This application does not belong to your account" },
        { status: 403 },
      );
    }

    if (app.status !== "Admitted") {
      return NextResponse.json(
        { error: "There is no active admission offer to respond to" },
        { status: 400 },
      );
    }

    if (app.offerResponse === "accepted" || app.offerResponse === "declined") {
      return NextResponse.json(
        {
          error: `You have already ${app.offerResponse} this offer`,
          application: serializeApplication(app),
        },
        { status: 400 },
      );
    }

    const now = new Date();
    await applicationsCollection(db).updateOne(
      { _id: app._id },
      {
        $set: {
          offerResponse: response,
          offerRespondedAt: now,
          updatedAt: now,
        },
      },
    );

    const refreshed = await applicationsCollection(db).findOne({ _id: app._id });
    return NextResponse.json({
      ok: true,
      application: refreshed ? serializeApplication(refreshed) : null,
    });
  } catch (error) {
    console.error("[apply/offer-response]", error);
    return NextResponse.json(
      { error: "Could not save your response. Please try again." },
      { status: 500 },
    );
  }
}
