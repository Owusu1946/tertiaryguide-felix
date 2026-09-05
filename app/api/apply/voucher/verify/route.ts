import { NextRequest, NextResponse } from "next/server";
import { verifyPaystackTransaction } from "../../../../../lib/paystack";
import { getDb } from "../../../../../lib/mongodb";
import { fulfilPartnerVoucherPayment } from "../../../../../lib/admissions/fulfil-partner-voucher";
import { admissionPaymentsCollection } from "../../../../../lib/admissions/vouchers";

export async function GET(req: NextRequest) {
  try {
    const reference = req.nextUrl.searchParams.get("reference")?.trim();
    if (!reference) {
      return NextResponse.json({ error: "Reference is required" }, { status: 400 });
    }

    const db = await getDb();
    const existing = await admissionPaymentsCollection(db).findOne({ reference });

    const tx = await verifyPaystackTransaction(reference);
    if (tx.status !== "success") {
      return NextResponse.json({ error: "Payment not successful" }, { status: 400 });
    }

    const schoolId =
      (typeof tx.metadata?.schoolId === "string" && tx.metadata.schoolId) ||
      (existing ? String(existing.schoolId) : null);

    if (!schoolId) {
      return NextResponse.json({ error: "Missing school on payment" }, { status: 400 });
    }

    const email = (
      tx.customer?.email ||
      existing?.email ||
      ""
    ).toLowerCase();

    const fullName =
      (typeof tx.metadata?.fullName === "string" && tx.metadata.fullName) ||
      existing?.fullName ||
      undefined;

    const amountGhs = (tx.amount || 0) / 100;

    const programmeLevel =
      (typeof tx.metadata?.programmeLevel === "string" &&
        tx.metadata.programmeLevel) ||
      existing?.programmeLevel ||
      undefined;

    const result = await fulfilPartnerVoucherPayment({
      db,
      reference,
      schoolId,
      email,
      fullName: fullName || undefined,
      amountGhs,
      programmeLevel:
        programmeLevel === "undergraduate" || programmeLevel === "postgraduate"
          ? programmeLevel
          : undefined,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      alreadyFulfilled: result.alreadyFulfilled,
      emailSent: result.emailSent,
      emailError: result.emailError ?? null,
      email,
      voucher: result.voucher,
      school: result.school,
    });
  } catch (error) {
    console.error("[apply/voucher/verify]", error);
    return NextResponse.json(
      { error: "Could not verify payment. Please try again." },
      { status: 500 },
    );
  }
}
