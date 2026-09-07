import { ObjectId } from "mongodb";
import type { Db } from "mongodb";
import { findSchoolById } from "./schools";
import {
  admissionPaymentsCollection,
  admissionVouchersCollection,
  createAdmissionVoucher,
  ensureAdmissionVoucherIndexes,
} from "./vouchers";
import { sendPartnerVoucherEmail } from "../email";
import { absoluteUrl } from "../site-url";
import type { AdmissionVoucherDoc, SchoolDoc } from "./types";
import type { ProgrammeLevel } from "./programme-level";
import { normalizeProgrammeLevel } from "./programme-level";
import { createUserNotification } from "../user-notifications-server";
import { PROGRAMME_LEVEL_LABELS } from "./programme-level";

export type FulfilPartnerPaymentResult = {
  ok: true;
  alreadyFulfilled: boolean;
  emailSent: boolean;
  emailError?: string | null;
  voucher: {
    voucherCode: string;
    serialNumber: string;
    amount: number;
    programmeLevel: ProgrammeLevel;
  };
  school: {
    id: string;
    name: string;
    slug: string | null;
  };
};

/**
 * After a successful Paystack payment: create voucher (if needed) and
 * email code + serial to the student. Safe to call multiple times.
 */
export async function fulfilPartnerVoucherPayment(opts: {
  db: Db;
  reference: string;
  schoolId: string;
  email: string;
  fullName?: string;
  amountGhs: number;
  programmeLevel?: ProgrammeLevel | null;
}): Promise<FulfilPartnerPaymentResult | { ok: false; error: string; status: number }> {
  const { db, reference, schoolId, fullName, amountGhs } = opts;
  const email = opts.email.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return { ok: false, error: "Buyer email is missing; cannot send voucher", status: 400 };
  }
  if (!ObjectId.isValid(schoolId)) {
    return { ok: false, error: "Invalid school id", status: 400 };
  }

  await ensureAdmissionVoucherIndexes(db);
  const payments = admissionPaymentsCollection(db);
  const school = await findSchoolById(db, schoolId);
  if (!school || !school.isPartner) {
    return { ok: false, error: "School not found", status: 404 };
  }

  const existing = await payments.findOne({ reference });
  const programmeLevel = normalizeProgrammeLevel(
    opts.programmeLevel ?? existing?.programmeLevel,
  );

  let voucher: AdmissionVoucherDoc | null = null;

  if (existing?.voucherId) {
    voucher = await admissionVouchersCollection(db).findOne({
      _id: existing.voucherId,
    });
  }

  if (!voucher) {
    voucher = await admissionVouchersCollection(db).findOne({
      paymentReference: reference,
    });
  }

  if (!voucher) {
    voucher = await createAdmissionVoucher({
      db,
      school,
      amount: amountGhs,
      paymentReference: reference,
      buyerEmail: email,
      programmeLevel,
    });
  }

  await payments.updateOne(
    { reference },
    {
      $set: {
        status: "success",
        paidAt: existing?.paidAt ?? new Date(),
        voucherId: voucher._id,
        amount: amountGhs,
        email,
        fullName: fullName ?? existing?.fullName ?? null,
        schoolId: school._id as ObjectId,
        product: "partner_voucher",
        programmeLevel,
      },
      $setOnInsert: {
        reference,
        currency: "GHS",
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );

  // Remove any mistaken university-form payment rows created for this reference
  // (forms/verify used to claim partner payments before product routing was fixed).
  await db.collection("voucherPayments").deleteMany({ reference });

  const emailResult = await sendVoucherEmailIfNeeded({
    db,
    reference,
    email,
    fullName: fullName ?? existing?.fullName ?? undefined,
    school,
    voucher,
  });

  return {
    ok: true,
    alreadyFulfilled: !!existing?.voucherId,
    emailSent: emailResult.sent,
    emailError: emailResult.error,
    voucher: {
      voucherCode: voucher.voucherCode,
      serialNumber: voucher.serialNumber,
      amount: voucher.amount,
      programmeLevel: voucher.programmeLevel ?? programmeLevel,
    },
    school: {
      id: String(school._id),
      name: school.name,
      slug: school.slug ?? null,
    },
  };
}

async function sendVoucherEmailIfNeeded(opts: {
  db: Db;
  reference: string;
  email: string;
  fullName?: string | null;
  school: SchoolDoc;
  voucher: AdmissionVoucherDoc;
}): Promise<{ sent: boolean; error: string | null }> {
  const { db, reference, email, fullName, school, voucher } = opts;
  const payments = admissionPaymentsCollection(db);
  const payment = await payments.findOne({ reference });

  // Already emailed successfully — do not spam the student
  if (payment?.emailSentAt) {
    return { sent: true, error: null };
  }

  const slugOrId = school.slug || String(school._id);
  const applyUrl = absoluteUrl(
    `/apply?school=${encodeURIComponent(slugOrId)}&step=login`,
  );
  const portalUrl = absoluteUrl(
    `/apply/portal?schoolId=${encodeURIComponent(String(school._id))}`,
  );
  const myFormsUrl = absoluteUrl("/dashboard/my-forms");

  try {
    await sendPartnerVoucherEmail({
      to: email,
      fullName: fullName || undefined,
      schoolName: school.name,
      voucherCode: voucher.voucherCode,
      serialNumber: voucher.serialNumber,
      applyUrl,
      portalUrl,
      myFormsUrl,
    });

    await payments.updateOne(
      { reference },
      {
        $set: {
          emailSentAt: new Date(),
          emailError: null,
        },
      },
    );

    return { sent: true, error: null };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send voucher email";
    console.error("[fulfilPartnerVoucherPayment] email failed", {
      reference,
      email,
      message,
    });

    await payments.updateOne(
      { reference },
      {
        $set: {
          emailError: message,
        },
      },
    );

    return { sent: false, error: message };
  }
}
