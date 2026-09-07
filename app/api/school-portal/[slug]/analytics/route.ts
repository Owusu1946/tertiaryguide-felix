import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../../lib/mongodb";
import { requireSchoolPortalAccess } from "../../../../../lib/admin-access";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  const auth = await requireSchoolPortalAccess(req, slug);
  if ("response" in auth) return auth.response;

  try {
    const db = await getDb();
    const apps = db.collection("applications");
    const payments = db.collection("admissionPayments");

    const [byDay, byMonth, byStatus, revenueByMonth, vouchersByLevel, vouchersPerMonth] =
      await Promise.all([
        apps
          .aggregate([
            { $match: { schoolId: auth.schoolId } },
            {
              $group: {
                _id: {
                  $dateToString: { format: "%Y-%m-%d", date: "$submittedAt" },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
            { $limit: 60 },
          ])
          .toArray(),
        apps
          .aggregate([
            { $match: { schoolId: auth.schoolId } },
            {
              $group: {
                _id: {
                  $dateToString: { format: "%Y-%m", date: "$submittedAt" },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
            { $limit: 24 },
          ])
          .toArray(),
        apps
          .aggregate([
            { $match: { schoolId: auth.schoolId } },
            { $group: { _id: "$status", count: { $sum: 1 } } },
          ])
          .toArray(),
        payments
          .aggregate([
            { $match: { schoolId: auth.schoolId, status: "success" } },
            {
              $group: {
                _id: {
                  $dateToString: { format: "%Y-%m", date: "$paidAt" },
                },
                total: { $sum: "$amount" },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
            { $limit: 24 },
          ])
          .toArray(),
        payments
          .aggregate([
            { $match: { schoolId: auth.schoolId, status: "success" } },
            {
              $group: {
                _id: {
                  $cond: [
                    { $eq: ["$programmeLevel", "postgraduate"] },
                    "postgraduate",
                    "undergraduate",
                  ],
                },
                count: { $sum: 1 },
                revenue: { $sum: "$amount" },
              },
            },
          ])
          .toArray(),
        payments
          .aggregate([
            { $match: { schoolId: auth.schoolId, status: "success" } },
            {
              $group: {
                _id: {
                  month: {
                    $dateToString: { format: "%Y-%m", date: "$paidAt" },
                  },
                  level: {
                    $cond: [
                      { $eq: ["$programmeLevel", "postgraduate"] },
                      "postgraduate",
                      "undergraduate",
                    ],
                  },
                },
                count: { $sum: 1 },
                revenue: { $sum: "$amount" },
              },
            },
            { $sort: { "_id.month": 1 } },
            { $limit: 48 },
          ])
          .toArray(),
      ]);

    const undergrad = vouchersByLevel.find((r) => r._id === "undergraduate");
    const postgrad = vouchersByLevel.find((r) => r._id === "postgraduate");

    // Merge monthly undergrad/postgrad purchase rows into one series
    const monthMap = new Map<
      string,
      { month: string; undergraduate: number; postgraduate: number; undergradRevenue: number; postgradRevenue: number }
    >();
    for (const row of vouchersPerMonth) {
      const month = row._id?.month || "Unknown";
      const level = row._id?.level === "postgraduate" ? "postgraduate" : "undergraduate";
      const existing = monthMap.get(month) || {
        month,
        undergraduate: 0,
        postgraduate: 0,
        undergradRevenue: 0,
        postgradRevenue: 0,
      };
      if (level === "postgraduate") {
        existing.postgraduate += row.count;
        existing.postgradRevenue += row.revenue || 0;
      } else {
        existing.undergraduate += row.count;
        existing.undergradRevenue += row.revenue || 0;
      }
      monthMap.set(month, existing);
    }

    return NextResponse.json({
      ok: true,
      applicationsPerDay: byDay.map((r) => ({ date: r._id, count: r.count })),
      applicationsPerMonth: byMonth.map((r) => ({ month: r._id, count: r.count })),
      applicationsByStatus: byStatus.map((r) => ({ status: r._id, count: r.count })),
      revenuePerMonth: revenueByMonth.map((r) => ({
        month: r._id,
        total: r.total,
        count: r.count,
      })),
      vouchersByLevel: {
        undergraduate: {
          count: undergrad?.count ?? 0,
          revenue: undergrad?.revenue ?? 0,
        },
        postgraduate: {
          count: postgrad?.count ?? 0,
          revenue: postgrad?.revenue ?? 0,
        },
      },
      vouchersPerMonthByLevel: Array.from(monthMap.values()).sort((a, b) =>
        a.month.localeCompare(b.month),
      ),
    });
  } catch (error) {
    console.error("[school-portal/analytics]", error);
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}
