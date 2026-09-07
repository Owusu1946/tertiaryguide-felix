import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../lib/mongodb";
import { requireStaff } from "../../../../lib/admin-access";
import {
  admissionPaymentsCollection,
  admissionVouchersCollection,
  ensureAdmissionVoucherIndexes,
} from "../../../../lib/admissions/vouchers";

/**
 * Platform admin: all partner-school vouchers sold, grouped by school.
 */
export async function GET(req: NextRequest) {
  const auth = await requireStaff(req);
  if ("response" in auth) return auth.response;

  try {
    const db = await getDb();
    await ensureAdmissionVoucherIndexes(db);

    const schoolIdParam = req.nextUrl.searchParams.get("schoolId");
    const voucherFilter: Record<string, unknown> = {
      status: { $ne: "revoked" },
    };
    if (schoolIdParam && ObjectId.isValid(schoolIdParam)) {
      voucherFilter.schoolId = new ObjectId(schoolIdParam);
    }

    const vouchers = await admissionVouchersCollection(db)
      .find(voucherFilter)
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();

    const paymentRefs = vouchers
      .map((v) => v.paymentReference)
      .filter((ref): ref is string => Boolean(ref));
    const payments =
      paymentRefs.length > 0
        ? await admissionPaymentsCollection(db)
            .find({ reference: { $in: paymentRefs } })
            .toArray()
        : [];
    const paymentByRef = new Map(payments.map((p) => [p.reference, p]));

    const schoolIds = Array.from(
      new Set(vouchers.map((v) => v.schoolId.toHexString())),
    ).map((id) => new ObjectId(id));

    const schools =
      schoolIds.length > 0
        ? await db
            .collection("schools")
            .find({ _id: { $in: schoolIds } })
            .toArray()
        : [];
    const schoolMap = Object.fromEntries(
      schools.map((s) => [
        s._id.toString(),
        {
          id: s._id.toString(),
          name: s.name,
          alias: s.alias ?? null,
          logo: s.logoSrc ?? null,
          slug: s.slug ?? null,
        },
      ]),
    );

    const items = vouchers.map((v) => {
      const school = schoolMap[v.schoolId.toHexString()] || {
        id: v.schoolId.toHexString(),
        name: "Unknown school",
        alias: null,
        logo: null,
        slug: null,
      };
      const payment = v.paymentReference
        ? paymentByRef.get(v.paymentReference)
        : null;
      return {
        id: String(v._id),
        schoolId: school.id,
        schoolName: school.alias?.trim() || school.name,
        schoolFullName: school.name,
        schoolLogo: school.logo,
        schoolSlug: school.slug,
        serial: v.serialNumber,
        pin: v.voucherCode,
        email: (v.purchasedBy || payment?.email || "").toLowerCase() || null,
        fullName: payment?.fullName ?? null,
        amount: v.amount,
        programmeLevel: v.programmeLevel ?? "undergraduate",
        status: v.status,
        isUsed: Boolean(v.isUsed),
        paymentReference: v.paymentReference ?? null,
        createdAt:
          v.createdAt instanceof Date
            ? v.createdAt.toISOString()
            : new Date().toISOString(),
        paidAt: payment?.paidAt
          ? payment.paidAt instanceof Date
            ? payment.paidAt.toISOString()
            : String(payment.paidAt)
          : null,
      };
    });

    const bySchool = new Map<
      string,
      {
        schoolId: string;
        schoolName: string;
        schoolFullName: string;
        schoolLogo: string | null;
        schoolSlug: string | null;
        count: number;
        vouchers: typeof items;
      }
    >();

    for (const item of items) {
      const existing = bySchool.get(item.schoolId);
      if (existing) {
        existing.count += 1;
        existing.vouchers.push(item);
      } else {
        bySchool.set(item.schoolId, {
          schoolId: item.schoolId,
          schoolName: item.schoolName,
          schoolFullName: item.schoolFullName,
          schoolLogo: item.schoolLogo,
          schoolSlug: item.schoolSlug,
          count: 1,
          vouchers: [item],
        });
      }
    }

    return NextResponse.json({
      ok: true,
      total: items.length,
      schools: Array.from(bySchool.values()).sort((a, b) =>
        a.schoolName.localeCompare(b.schoolName),
      ),
      vouchers: items,
    });
  } catch (error) {
    console.error("[admin/partner-vouchers]", error);
    return NextResponse.json(
      { error: "Could not load partner vouchers" },
      { status: 500 },
    );
  }
}
