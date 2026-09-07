import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";
import { requireStaff } from "../../../../lib/admin-access";
import {
  ensurePlatformActivityIndexes,
  platformActivityCollection,
  serializePlatformActivity,
  type ActivitySeverity,
  type ActivitySurface,
} from "../../../../lib/platform-activity";

const SURFACES: ActivitySurface[] = [
  "user",
  "admin",
  "partner_school",
  "public",
  "system",
];
const SEVERITIES: ActivitySeverity[] = ["info", "warning", "security"];

export async function GET(req: NextRequest) {
  const auth = await requireStaff(req);
  if ("response" in auth) return auth.response;

  try {
    const db = await getDb();
    await ensurePlatformActivityIndexes(db);

    const { searchParams } = req.nextUrl;
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const surface = searchParams.get("surface") || "All";
    const severity = searchParams.get("severity") || "All";
    const successParam = searchParams.get("success");
    const limitRaw = Number(searchParams.get("limit") || "150");
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 150, 1), 300);

    const filter: Record<string, unknown> = {};
    if (SURFACES.includes(surface as ActivitySurface)) {
      filter.surface = surface;
    }
    if (SEVERITIES.includes(severity as ActivitySeverity)) {
      filter.severity = severity;
    }
    if (successParam === "true") filter.success = true;
    if (successParam === "false") filter.success = false;

    if (q) {
      filter.$or = [
        { summary: { $regex: q, $options: "i" } },
        { action: { $regex: q, $options: "i" } },
        { actorUsername: { $regex: q, $options: "i" } },
        { actorEmail: { $regex: q, $options: "i" } },
        { schoolName: { $regex: q, $options: "i" } },
        { schoolSlug: { $regex: q, $options: "i" } },
        { ip: { $regex: q, $options: "i" } },
        { targetId: { $regex: q, $options: "i" } },
      ];
    }

    const docs = await platformActivityCollection(db)
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json({
      ok: true,
      logs: docs.map(serializePlatformActivity),
    });
  } catch (error) {
    console.error("[admin/activity-logs] GET", error);
    return NextResponse.json(
      { error: "Failed to load activity logs" },
      { status: 500 },
    );
  }
}
