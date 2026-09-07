import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../../lib/mongodb";
import { verifyPaystackTransaction } from "../../../../../lib/paystack";
import {
  sendFormVoucherEmail,
  sendFormPendingVoucherToAdmin,
} from "../../../../../lib/email";
import {
  normalizeProgrammeLevel,
  schoolVoucherLevelFilter,
  type ProgrammeLevel,
} from "../../../../../lib/admissions/programme-level";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reference = searchParams.get("reference");

    if (!reference) {
      return NextResponse.json({ error: "Missing reference" }, { status: 400 });
    }

    const tx = await verifyPaystackTransaction(reference);

    if (tx.status !== "success") {
      return NextResponse.json(
        {
          error:
            "Payment failed or is incomplete. Your voucher was not issued. Please contact support or try again.",
        },
        { status: 400 },
      );
    }

    const email = tx.customer?.email;
    if (!email) {
      return NextResponse.json(
        { error: "No email found on transaction" },
        { status: 400 },
      );
    }

    const product = tx.metadata?.product;
    // Secured / apply-online vouchers are fulfilled by /api/apply/voucher/verify
    if (product === "partner_voucher") {
      return NextResponse.json(
        { error: "Use partner voucher verification for this payment" },
        { status: 400 },
      );
    }

    const schoolIdRaw = tx.metadata?.schoolId;
    if (typeof schoolIdRaw !== "string" || !ObjectId.isValid(schoolIdRaw)) {
      return NextResponse.json(
        { error: "Invalid or missing school id on transaction" },
        { status: 400 },
      );
    }

    const schoolId = new ObjectId(schoolIdRaw);
    const programmeLevel = normalizeProgrammeLevel(tx.metadata?.programmeLevel);

    const db = await getDb();

    const schoolsCol = db.collection<{
      _id: ObjectId;
      name: string;
      isPartner?: boolean;
    }>("schools");

    const schoolDoc = await schoolsCol.findOne({ _id: schoolId });
    // Partner (secured) schools auto-generate admission vouchers — never drain admin stock here
    if (schoolDoc?.isPartner) {
      return NextResponse.json(
        { error: "Use partner voucher verification for this payment" },
        { status: 400 },
      );
    }

    const vouchers = db.collection<{
      _id?: ObjectId;
      schoolId: ObjectId;
      serial: string;
      pin: string;
      status: "Unserved" | "Served";
      programmeLevel?: ProgrammeLevel | null;
      issuedTo?: string | null;
      issuedAt?: Date | null;
      createdAt?: Date;
    }>("schoolVouchers");

    const payments = db.collection<{
      reference: string;
      email: string;
      fullName?: string | null;
      amount: number;
      currency: string;
      status: string;
      schoolId: ObjectId;
      programmeLevel?: ProgrammeLevel;
      voucher: { serial: string; pin: string } | null;
      paidAt: Date;
      createdAt: Date;
    }>("voucherPayments");

    const existing = await payments.findOne({ reference: tx.reference });
    if (existing) {
      if (existing.voucher) {
        return NextResponse.json(
          {
            ok: true,
            email: existing.email,
            voucher: existing.voucher,
            reference: existing.reference,
            programmeLevel: normalizeProgrammeLevel(existing.programmeLevel),
            pending: false,
          },
          { status: 200 },
        );
      }

      return NextResponse.json(
        {
          ok: true,
          email: existing.email,
          voucher: null,
          reference: existing.reference,
          programmeLevel: normalizeProgrammeLevel(existing.programmeLevel),
          pending: true,
        },
        { status: 200 },
      );
    }

    const schoolName = schoolDoc?.name?.trim() || "University";

    const availableCount = await vouchers.countDocuments({
      schoolId,
      status: "Unserved",
      ...schoolVoucherLevelFilter(programmeLevel),
    });

    if (availableCount < 1) {
      const now = new Date();

      const fullName =
        typeof tx.metadata?.fullName === "string" ? tx.metadata.fullName : undefined;

      await payments.insertOne({
        reference: tx.reference,
        email,
        fullName: fullName ?? null,
        amount: tx.amount,
        currency: tx.currency,
        status: tx.status,
        schoolId,
        programmeLevel,
        voucher: null,
        paidAt: now,
        createdAt: now,
      });

      try {
        await sendFormPendingVoucherToAdmin({
          schoolName,
          schoolId: schoolId.toHexString(),
          buyerEmail: email,
          fullName: fullName ?? null,
          paystackReference: tx.reference,
          amountMinor: tx.amount,
          currency: tx.currency,
          paidAt: now,
        });
      } catch (mailErr) {
        console.error(
          "[payments/forms/verify] admin notify (no stock) failed",
          mailErr,
        );
      }

      return NextResponse.json(
        {
          ok: true,
          email,
          voucher: null,
          reference: tx.reference,
          programmeLevel,
          pending: true,
        },
        { status: 200 },
      );
    }
    const now = new Date();

    const result = await vouchers.findOneAndUpdate(
      {
        schoolId,
        status: "Unserved",
        ...schoolVoucherLevelFilter(programmeLevel),
      },
      {
        $set: {
          status: "Served",
          issuedTo: email,
          issuedAt: now,
        },
      },
      {
        sort: { createdAt: 1 },
        returnDocument: "after",
      },
    );

    const doc = (result as any)?.value ?? (result as any) ?? null;
    if (!doc || !doc.serial || !doc.pin) {
      return NextResponse.json(
        {
          error:
            "We ran into an issue issuing your voucher. Please contact support.",
        },
        { status: 400 },
      );
    }

    const fullName =
      typeof tx.metadata?.fullName === "string" ? tx.metadata.fullName : undefined;

    const voucher = { serial: doc.serial, pin: doc.pin };

    await payments.insertOne({
      reference: tx.reference,
      email,
      fullName: fullName ?? null,
      amount: tx.amount,
      currency: tx.currency,
      status: tx.status,
      schoolId,
      programmeLevel,
      voucher,
      paidAt: now,
      createdAt: now,
    });

    let emailSent = false;
    let emailError: string | null = null;
    try {
      await sendFormVoucherEmail({
        to: email,
        fullName,
        schoolId: schoolIdRaw,
        schoolName,
        voucher,
      });
      emailSent = true;
    } catch (mailErr) {
      emailError =
        mailErr instanceof Error ? mailErr.message : "Failed to send voucher email";
      console.error("[payments/forms/verify] voucher email failed", mailErr);
    }

    return NextResponse.json(
      {
        ok: true,
        email,
        voucher,
        reference: tx.reference,
        programmeLevel,
        emailSent,
        emailError,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[payments/forms/verify] error", error);
    return NextResponse.json(
      { error: "Could not verify payment" },
      { status: 500 },
    );
  }
}
