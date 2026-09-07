import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../lib/mongodb";
import {
  admissionPaymentsCollection,
  admissionVouchersCollection,
  ensureAdmissionVoucherIndexes,
} from "../../../../lib/admissions/vouchers";
import {
  applicationsCollection,
  serializeApplication,
} from "../../../../lib/admissions/applications";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const emailRaw = searchParams.get("email");
    const email = emailRaw?.trim().toLowerCase() || "";

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const db = await getDb();
    await ensureAdmissionVoucherIndexes(db);

    // Fetch university form payments (exclude partner/secured schools — those use admissionVouchers)
    const formPaymentsRaw = await db
      .collection("voucherPayments")
      .find({ email, status: "success" })
      .sort({ paidAt: -1 })
      .toArray();

    const schoolIds = formPaymentsRaw.map((p) => p.schoolId);
    const schools = await db
      .collection("schools")
      .find({ _id: { $in: schoolIds } })
      .toArray();

    const schoolMap = Object.fromEntries(
      schools.map((s) => [
        s._id.toString(),
        {
          name: s.name,
          alias: s.alias ?? null,
          logo: s.logoSrc,
          slug: s.slug ?? null,
          isPartner: Boolean(s.isPartner),
        },
      ]),
    );

    const formPayments = formPaymentsRaw.filter((p) => {
      const info = schoolMap[p.schoolId.toString()];
      return !info?.isPartner;
    });

    const enrichedFormPayments = formPayments.map((p) => {
      const schoolInfo = schoolMap[p.schoolId.toString()] || {
        name: "Unknown School",
        alias: null,
        logo: null,
        slug: null,
      };
      return {
        id: p._id.toString(),
        type: "university_form" as const,
        schoolName: schoolInfo.name,
        schoolLogo: schoolInfo.logo,
        date: p.paidAt,
        voucher: p.voucher,
        programmeLevel: p.programmeLevel ?? "undergraduate",
        status: p.voucher ? "issued" : "pending",
      };
    });

    // Fetch WASSCE checker payments
    const wasscePayments = await db
      .collection("checkerPayments")
      .find({ email, status: "success" })
      .sort({ paidAt: -1 })
      .toArray();

    const enrichedWasscePayments = wasscePayments.map((p) => ({
      id: p._id.toString(),
      type: "wassce_checker" as const,
      name: "WASSCE Checker",
      date: p.paidAt,
      vouchers: p.checkers || [],
      quantity: p.quantity,
      status: (p.checkers?.length || 0) > 0 ? "issued" : "pending",
    }));

    // Partner / direct-application vouchers owned by this account
    const partnerVouchers = await admissionVouchersCollection(db)
      .find({
        $or: [{ purchasedBy: email }, { usedBy: email }],
        status: { $ne: "revoked" },
      })
      .sort({ createdAt: -1 })
      .toArray();

    // Also include successful payments that may not have linked purchasedBy yet
    const partnerPayments = await admissionPaymentsCollection(db)
      .find({ email, status: "success", product: "partner_voucher" })
      .sort({ paidAt: -1 })
      .toArray();

    const voucherIdsFromPayments = partnerPayments
      .map((p) => p.voucherId)
      .filter((id): id is ObjectId => Boolean(id));

    const extraVouchers =
      voucherIdsFromPayments.length > 0
        ? await admissionVouchersCollection(db)
            .find({
              _id: { $in: voucherIdsFromPayments },
              status: { $ne: "revoked" },
            })
            .toArray()
        : [];

    const partnerById = new Map<string, (typeof partnerVouchers)[number]>();
    for (const v of [...partnerVouchers, ...extraVouchers]) {
      if (v._id) partnerById.set(v._id.toHexString(), v);
    }

    const partnerSchoolIds = Array.from(
      new Set([
        ...Array.from(partnerById.values()).map((v) => v.schoolId.toHexString()),
        ...partnerPayments.map((p) => p.schoolId.toHexString()),
      ]),
    ).map((id) => new ObjectId(id));

    const partnerSchools =
      partnerSchoolIds.length > 0
        ? await db
            .collection("schools")
            .find({ _id: { $in: partnerSchoolIds } })
            .toArray()
        : [];

    const partnerSchoolMap = Object.fromEntries(
      partnerSchools.map((s) => [
        s._id.toString(),
        {
          name: s.name,
          alias: s.alias ?? null,
          logo: s.logoSrc ?? null,
          slug: s.slug ?? null,
          deadline: s.deadline ? new Date(s.deadline).toISOString() : null,
          brandColor: s.brandColor ?? null,
          brandColors: Array.isArray(s.brandColors) ? s.brandColors : null,
          phone: s.phone ?? null,
          email: s.email ?? null,
          address: s.address ?? null,
        },
      ]),
    );

    const voucherObjectIds = Array.from(partnerById.values())
      .map((v) => v._id)
      .filter((id): id is ObjectId => Boolean(id));

    const partnerApps =
      voucherObjectIds.length > 0
        ? await applicationsCollection(db)
            .find({ voucherId: { $in: voucherObjectIds } })
            .toArray()
        : [];

    const appByVoucherId = new Map(
      partnerApps
        .filter((a) => a.voucherId)
        .map((a) => [String(a.voucherId), a]),
    );

    const paymentByVoucherId = new Map(
      partnerPayments
        .filter((p) => p.voucherId)
        .map((p) => [String(p.voucherId), p]),
    );

    const enrichedPartner = Array.from(partnerById.values()).map((v) => {
      const schoolInfo = partnerSchoolMap[v.schoolId.toHexString()] || {
        name: "Unknown School",
        alias: null,
        logo: null,
        slug: null,
        deadline: null,
        brandColor: null,
        brandColors: null,
        phone: null,
        email: null,
        address: null,
      };
      const payment = v._id ? paymentByVoucherId.get(v._id.toHexString()) : null;
      const application = v._id
        ? appByVoucherId.get(v._id.toHexString())
        : null;
      const date =
        payment?.paidAt ||
        v.createdAt ||
        application?.submittedAt ||
        new Date();

      return {
        id: String(v._id),
        type: "partner_voucher" as const,
        schoolId: v.schoolId.toHexString(),
        schoolName: schoolInfo.alias?.trim() || schoolInfo.name,
        schoolFullName: schoolInfo.name,
        schoolLogo: schoolInfo.logo,
        schoolSlug: schoolInfo.slug,
        deadline: schoolInfo.deadline ?? null,
        schoolBrandColor: schoolInfo.brandColor ?? null,
        schoolBrandColors: schoolInfo.brandColors ?? null,
        schoolPhone: schoolInfo.phone ?? null,
        schoolEmail: schoolInfo.email ?? null,
        schoolAddress: schoolInfo.address ?? null,
        date,
        voucher: {
          serial: v.serialNumber,
          pin: v.voucherCode,
        },
        programmeLevel: v.programmeLevel ?? "undergraduate",
        status: v.isUsed || v.status === "used" ? "used" : "issued",
        application: application
          ? (() => {
              const detail = serializeApplication(application);
              return {
                id: String(application._id),
                applicationNumber: application.applicationNumber || detail.applicationNumber,
                status: application.status,
                submittedAt: application.submittedAt?.toISOString?.()
                  ? application.submittedAt.toISOString()
                  : null,
                programmes: detail.programmes,
                programme: detail.programme,
                admittedProgramme: detail.admittedProgramme,
                admittedProgrammeStream: detail.admittedProgrammeStream,
                offerResponse: detail.offerResponse,
                detail,
              };
            })()
          : null,
      };
    });

    // Pending partner payments without a voucher yet
    const pendingPartner = partnerPayments
      .filter((p) => !p.voucherId)
      .map((p) => {
        const schoolInfo = partnerSchoolMap[p.schoolId.toHexString()] || {
          name: "Unknown School",
          alias: null,
          logo: null,
          slug: null,
          deadline: null,
          brandColor: null,
          brandColors: null,
          phone: null,
          email: null,
          address: null,
        };
        return {
          id: `pending-${p._id}`,
          type: "partner_voucher" as const,
          schoolId: p.schoolId.toHexString(),
          schoolName: schoolInfo.alias?.trim() || schoolInfo.name,
          schoolFullName: schoolInfo.name,
          schoolLogo: schoolInfo.logo,
          schoolSlug: schoolInfo.slug,
          deadline: schoolInfo.deadline ?? null,
          schoolBrandColor: schoolInfo.brandColor ?? null,
          schoolBrandColors: schoolInfo.brandColors ?? null,
          schoolPhone: schoolInfo.phone ?? null,
          schoolEmail: schoolInfo.email ?? null,
          schoolAddress: schoolInfo.address ?? null,
          date: p.paidAt || p.createdAt,
          voucher: null as { serial: string; pin: string } | null,
          programmeLevel: p.programmeLevel ?? "undergraduate",
          status: "pending" as const,
          application: null,
        };
      });

    const linkedAppIds = new Set(
      [...partnerApps, ...Array.from(appByVoucherId.values())].map((a) =>
        String(a._id),
      ),
    );
    const emailApps = await applicationsCollection(db)
      .find({
        $or: [{ applicantEmail: email }, { "personalInfo.email": email }],
      })
      .toArray();
    const standaloneApps = emailApps.filter(
      (app) => !linkedAppIds.has(String(app._id)),
    );
    const standaloneSchoolIds = standaloneApps
      .map((app) => app.schoolId)
      .filter((id): id is ObjectId => Boolean(id));
    const standaloneSchools =
      standaloneSchoolIds.length > 0
        ? await db
            .collection("schools")
            .find({ _id: { $in: standaloneSchoolIds } })
            .toArray()
        : [];
    for (const school of standaloneSchools) {
      partnerSchoolMap[school._id.toString()] = {
        name: school.name,
        alias: school.alias ?? null,
        logo: school.logoSrc ?? null,
        slug: school.slug ?? null,
        deadline: school.deadline ? new Date(school.deadline).toISOString() : null,
        brandColor: school.brandColor ?? null,
        brandColors: Array.isArray(school.brandColors) ? school.brandColors : null,
        phone: school.phone ?? null,
        email: school.email ?? null,
        address: school.address ?? null,
      };
    }
    const standalonePartner = standaloneApps.map((application) => {
      const schoolInfo = partnerSchoolMap[String(application.schoolId)] || {
        name: "Unknown School",
        alias: null,
        logo: null,
        slug: null,
        deadline: null,
        brandColor: null,
        brandColors: null,
        phone: null,
        email: null,
        address: null,
      };
      const detail = serializeApplication(application);
      return {
        id: `app-${String(application._id)}`,
        type: "partner_voucher" as const,
        schoolId: String(application.schoolId),
        schoolName: schoolInfo.alias?.trim() || schoolInfo.name,
        schoolFullName: schoolInfo.name,
        schoolLogo: schoolInfo.logo,
        schoolSlug: schoolInfo.slug,
        deadline: schoolInfo.deadline ?? null,
        schoolBrandColor: schoolInfo.brandColor ?? null,
        schoolBrandColors: schoolInfo.brandColors ?? null,
        schoolPhone: schoolInfo.phone ?? null,
        schoolEmail: schoolInfo.email ?? null,
        schoolAddress: schoolInfo.address ?? null,
        date: application.submittedAt || application.updatedAt || new Date(),
        voucher: null as { serial: string; pin: string } | null,
        programmeLevel: "undergraduate" as const,
        status: "used" as const,
        application: {
          id: String(application._id),
          applicationNumber: application.applicationNumber || detail.applicationNumber,
          status: application.status,
          submittedAt: application.submittedAt?.toISOString?.()
            ? application.submittedAt.toISOString()
            : null,
          programmes: detail.programmes,
          programme: detail.programme,
          admittedProgramme: detail.admittedProgramme,
          admittedProgrammeStream: detail.admittedProgrammeStream,
          offerResponse: detail.offerResponse,
          detail,
        },
      };
    });

    const allPurchases = [
      ...enrichedFormPayments,
      ...enrichedWasscePayments,
      ...enrichedPartner,
      ...pendingPartner,
      ...standalonePartner,
    ].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return NextResponse.json({ purchases: allPurchases }, { status: 200 });
  } catch (error) {
    console.error("[api/user/purchases] error", error);
    return NextResponse.json(
      { error: "Could not fetch purchases" },
      { status: 500 },
    );
  }
}
