import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { initializePaystackTransaction } from "../../../../../lib/paystack";
import { getDb } from "../../../../../lib/mongodb";
import { paymentReturnCallbackUrl } from "../../../../../lib/site-url";
import {
  parseProgrammeLevel,
  PROGRAMME_LEVEL_LABELS,
} from "../../../../../lib/admissions/programme-level";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fullName, email, schoolId } = body as {
      fullName?: string;
      email?: string;
      schoolId?: string;
      programmeLevel?: string;
      returnOrigin?: string;
    };
    const programmeLevel = parseProgrammeLevel(body?.programmeLevel);

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
    const schools = db.collection<{
      _id: ObjectId;
      priceGhs?: number | null;
      undergraduateVoucherPrice?: number | null;
      postgraduateVoucherPrice?: number | null;
      voucherPrice?: number | null;
    }>("schools");

    const school = await schools.findOne({ _id: new ObjectId(schoolId) });
    if (!school) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    const levelPrice =
      programmeLevel === "postgraduate"
        ? school.postgraduateVoucherPrice
        : school.undergraduateVoucherPrice;
    const priceGhsRaw =
      typeof levelPrice === "number" && Number.isFinite(levelPrice)
        ? levelPrice
        : typeof school.voucherPrice === "number" && Number.isFinite(school.voucherPrice)
          ? school.voucherPrice
          : school.priceGhs;

    if (typeof priceGhsRaw !== "number" || !Number.isFinite(priceGhsRaw) || priceGhsRaw <= 0) {
      return NextResponse.json(
        {
          error: `This school does not have a valid ${PROGRAMME_LEVEL_LABELS[programmeLevel].toLowerCase()} form price configured`,
        },
        { status: 400 },
      );
    }

    const amountPesewas = Math.round(priceGhsRaw * 100);

    // Public return page (no query string) — Paystack appends ?reference=
    const callbackUrl = paymentReturnCallbackUrl(
      typeof body?.returnOrigin === "string" ? body.returnOrigin : null,
    );

    const tx = await initializePaystackTransaction({
      email,
      amountPesewas,
      callbackUrl,
      metadata: {
        fullName,
        schoolId,
        product: "school_voucher",
        programmeLevel,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        authorizationUrl: tx.authorization_url,
        reference: tx.reference,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[payments/forms/init] error", error);
    return NextResponse.json(
      { error: "Could not start payment. Please try again." },
      { status: 500 },
    );
  }
}
