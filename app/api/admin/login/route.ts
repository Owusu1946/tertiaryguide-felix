import { NextRequest, NextResponse } from "next/server";
import type { ObjectId } from "mongodb";
import { getDb } from "../../../../lib/mongodb";
import { verifyPassword } from "../../../../lib/password";
import { STAFF_ROLES } from "../../../../lib/admin-access";
import { SCHOOL_ADMIN_ROLE } from "../../../../lib/admissions/types";
import { findSchoolById } from "../../../../lib/admissions/schools";
import { logPlatformActivity } from "../../../../lib/platform-activity";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      await logPlatformActivity({
        req,
        action: "admin.login.rejected",
        surface: "admin",
        severity: "security",
        actorKind: "anonymous",
        actorUsername: username || null,
        summary: "Admin/partner login rejected: missing credentials",
        success: false,
      });
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const users = db.collection("users");

    const adminDoc = await users.findOne<{
      _id: ObjectId;
      username: string;
      email: string;
      passwordHash?: string;
      role?: string;
      schoolId?: ObjectId;
    }>({
      username,
      role: { $in: [...STAFF_ROLES, SCHOOL_ADMIN_ROLE] },
    });

    if (!adminDoc || !adminDoc.passwordHash) {
      await logPlatformActivity({
        req,
        action: "admin.login.failed",
        surface: "admin",
        severity: "security",
        actorKind: "anonymous",
        actorUsername: username,
        summary: `Failed admin/partner login for "${username}"`,
        success: false,
        meta: { reason: "unknown_admin" },
      });
      return NextResponse.json(
        { error: "Invalid admin credentials" },
        { status: 400 },
      );
    }

    const valid = await verifyPassword(password, adminDoc.passwordHash);

    if (!valid) {
      const role = adminDoc.role || "admin";
      await logPlatformActivity({
        req,
        action: "admin.login.failed",
        surface: role === SCHOOL_ADMIN_ROLE ? "partner_school" : "admin",
        severity: "security",
        actorKind: role === SCHOOL_ADMIN_ROLE ? "school_admin" : "staff",
        actorId: String(adminDoc._id),
        actorUsername: adminDoc.username,
        actorEmail: adminDoc.email,
        summary: `Failed ${role} login (bad password) for "${username}"`,
        success: false,
        meta: { reason: "bad_password", role },
      });
      return NextResponse.json(
        { error: "Invalid admin credentials" },
        { status: 400 },
      );
    }

    await users.updateOne(
      { _id: adminDoc._id },
      { $set: { lastLoginAt: new Date() } },
    );

    const role = adminDoc.role || "admin";
    let schoolSlug: string | null = null;
    let schoolId: string | null = null;
    let schoolName: string | null = null;

    if (role === SCHOOL_ADMIN_ROLE && adminDoc.schoolId) {
      schoolId = String(adminDoc.schoolId);
      const school = await findSchoolById(db, schoolId);
      schoolSlug = school?.slug ?? null;
      schoolName = school?.name ?? null;
      if (school && school.isActive === false) {
        await logPlatformActivity({
          req,
          action: "partner.login.blocked",
          surface: "partner_school",
          severity: "warning",
          actorKind: "school_admin",
          actorId: String(adminDoc._id),
          actorUsername: adminDoc.username,
          actorEmail: adminDoc.email,
          schoolId,
          schoolSlug,
          schoolName,
          summary: `Partner login blocked for disabled school "${schoolName || schoolSlug}"`,
          success: false,
        });
        return NextResponse.json(
          { error: "This school portal is currently disabled" },
          { status: 403 },
        );
      }
    }

    const isPartner = role === SCHOOL_ADMIN_ROLE;
    await logPlatformActivity({
      req,
      action: isPartner ? "partner.login.success" : "admin.login.success",
      surface: isPartner ? "partner_school" : "admin",
      severity: "info",
      actorKind: isPartner ? "school_admin" : "staff",
      actorId: String(adminDoc._id),
      actorUsername: adminDoc.username,
      actorEmail: adminDoc.email,
      schoolId,
      schoolSlug,
      schoolName,
      summary: isPartner
        ? `Partner admin "${adminDoc.username}" signed in${schoolName ? ` (${schoolName})` : ""}`
        : `Staff "${adminDoc.username}" (${role}) signed in`,
      success: true,
      meta: { role },
    });

    return NextResponse.json(
      {
        ok: true,
        admin: {
          id: String(adminDoc._id),
          username: adminDoc.username,
          email: adminDoc.email,
          role,
          schoolId,
          schoolSlug,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[admin/login] error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
