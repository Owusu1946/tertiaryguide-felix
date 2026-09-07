import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { initializePaystackTransaction } from "../../../../../lib/paystack";
import { getDb } from "../../../../../lib/mongodb";
import { findSchoolById } from "../../../../../lib/admissions/schools";
import {
  admissionPaymentsCollection,
  ensureAdmissionVoucherIndexes,
  resolvePartnerVoucherAmount,
} from "../../../../../lib/admissions/vouchers";
import { paymentReturnCallbackUrl } from "../../../../../lib/site-url";
import {
  parseProgrammeLevel,
  PROGRAMME_LEVEL_LABELS,
} from "../../../../../lib/admissions/programme-level";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const schoolId = typeof body?.schoolId === "string" ? body.schoolId : "";
    const programmeLevel = parseProgrammeLevel(body?.programmeLevel);
    const returnOrigin =
      typeof body?.returnOrigin === "string" ? body.returnOrigin : null;

    if (!fullName || !email || !schoolId) {
      return NextResponse.json(
        { error: "Full name, email, and schoolId are required" },
        { status: 400 },
      );
    }
    if (!programmeLevel) {
      return NextResponse.json(
        { error: "Please select Undergraduate or Postgraduate" },
        { status: 400 },
      );
    }
    if (!ObjectId.isValid(schoolId)) {
      return NextResponse.json({ error: "Invalid school id" }, { status: 400 });
    }

    const db = await getDb();
    await ensureAdmissionVoucherIndexes(db);

    const school = await findSchoolById(db, schoolId);
    if (!school || !school.isPartner || school.isActive === false) {
      return NextResponse.json({ error: "School not available" }, { status: 404 });
    }
    if (school.requiresVoucher === false) {
      return NextResponse.json(
        { error: "This school does not require a voucher" },
        { status: 400 },
      );
    }

    const priceGhs = resolvePartnerVoucherAmount(school, programmeLevel);
    if (priceGhs === null) {
      return NextResponse.json(
        {
          error: `This school does not have a valid ${PROGRAMME_LEVEL_LABELS[programmeLevel].toLowerCase()} voucher price`,
        },
        { status: 400 },
      );
    }

    const amountPesewas = Math.round(priceGhs * 100);
    const slug = school.slug || schoolId;
    const callbackUrl = paymentReturnCallbackUrl(returnOrigin, {
      from: "partner",
    });

    const tx = await initializePaystackTransaction({
      email,
      amountPesewas,
      callbackUrl,
      metadata: {
        fullName,
        schoolId,
        schoolSlug: slug,
        product: "partner_voucher",
        programmeLevel,
      },
    });

    await admissionPaymentsCollection(db).insertOne({
      schoolId: new ObjectId(schoolId),
      reference: tx.reference,
      email,
      fullName,
      amount: priceGhs,
      currency: "GHS",
      status: "pending",
      product: "partner_voucher",
      programmeLevel,
      voucherId: null,
      paidAt: null,
      createdAt: new Date(),
    });

    return NextResponse.json({
      ok: true,
      authorizationUrl: tx.authorization_url,
      reference: tx.reference,
    });
  } catch (error) {
    console.error("[apply/voucher/init]", error);
    return NextResponse.json(
      { error: "Could not start payment. Please try again." },
      { status: 500 },
    );
  }
}
