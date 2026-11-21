import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";
import { requireStaff } from "../../../../lib/admin-access";
import { invalidateSchoolsCache } from "../../../../lib/redis";
import {
  allocateUniqueSlug,
  ensureSchoolIndexes,
  listPartnerSchools,
  schoolsCollection,
  serializePartnerSchool,
} from "../../../../lib/admissions/schools";
import { normalizeSlug } from "../../../../lib/admissions/slug";
import { hashPassword } from "../../../../lib/password";
import { SCHOOL_ADMIN_ROLE } from "../../../../lib/admissions/types";
import { createSchoolPortalInvite } from "../../../../lib/admissions/school-portal-invite";
import { sendSchoolPortalInviteEmail } from "../../../../lib/email";
import { absoluteUrl } from "../../../../lib/site-url";
import { schoolCategoriesFromRequestBody } from "../../../../lib/schoolCategories";

export async function GET(req: NextRequest) {
  const auth = await requireStaff(req);
  if ("response" in auth) return auth.response;

  try {
    const db = await getDb();
    await ensureSchoolIndexes(db);
    const docs = await listPartnerSchools(db);
    return NextResponse.json({
      ok: true,
      schools: docs.map(serializePartnerSchool),
    });
  } catch (error) {
    console.error("[admin/partner-schools] GET", error);
    return NextResponse.json({ error: "Failed to load partner schools" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaff(req);
  if ("response" in auth) return auth.response;

  try {
    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "School name is required" }, { status: 400 });
    }

    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) {
      return NextResponse.json(
        { error: "School email is required so we can send the portal invite" },
        { status: 400 },
      );
    }

    const adminUsername =
      typeof body?.adminUsername === "string" ? body.adminUsername.trim() : "";
    const adminPassword =
      typeof body?.adminPassword === "string" ? body.adminPassword : "";
    if (!adminUsername || !adminPassword) {
      return NextResponse.json(
        {
          error:
            "School admin username and password are required. Share them with the school separately.",
        },
        { status: 400 },
      );
    }
    if (adminPassword.length < 8) {
      return NextResponse.json(
        { error: "School admin password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const db = await getDb();
    await ensureSchoolIndexes(db);

    const slugInput =
      typeof body?.slug === "string" && body.slug.trim()
        ? normalizeSlug(body.slug)
        : name;
    const slug = await allocateUniqueSlug(db, slugInput);
    const now = new Date();

    const adminEmail =
      typeof body?.adminEmail === "string" && body.adminEmail.trim()
        ? body.adminEmail.trim().toLowerCase()
        : email;

    const users = db.collection("users");
    const existing = await users.findOne({
      $or: [{ username: adminUsername }, { email: adminEmail }],
    });
    if (existing) {
      return NextResponse.json(
        { error: "School admin username or email already exists" },
        { status: 400 },
      );
    }

    const doc = {
      name,
      alias: typeof body?.alias === "string" ? body.alias.trim() || null : null,
      slug,
      email,
      phone: typeof body?.phone === "string" ? body.phone.trim() || null : null,
      address: null as string | null,
      description: null as string | null,
      about: null as string | null,
      logoSrc: typeof body?.logoSrc === "string" ? body.logoSrc.trim() || null : null,
      logoAlt:
        typeof body?.logoAlt === "string" ? body.logoAlt.trim() || name : name,
      voucherPrice: null as number | null,
      priceGhs: null as number | null,
      admissionFee: null as number | null,
      deadline: null as Date | null,
      requiresVoucher: true,
      isActive: body?.isActive !== false,
      isPartner: true,
      isVerified: body?.isVerified !== false,
      showBlogOnMain: body?.showBlogOnMain === true,
      brandColor: null as string | null,
      categories: [...schoolCategoriesFromRequestBody(body)],
      createdAt: now,
      updatedAt: now,
    };

    const result = await schoolsCollection(db).insertOne(doc);
    const passwordHash = await hashPassword(adminPassword);
    await users.insertOne({
      username: adminUsername,
      email: adminEmail,
      passwordHash,
      role: SCHOOL_ADMIN_ROLE,
      schoolId: result.insertedId,
      createdAt: now,
      updatedAt: now,
    });

    const { token, expiresAt } = await createSchoolPortalInvite(db, {
      schoolId: result.insertedId,
      schoolSlug: slug,
      schoolName: name,
      email,
    });
    const loginUrl = absoluteUrl(
      `/admin/signin?invite=${encodeURIComponent(token)}`,
    );

    let inviteEmailSent = false;
    let inviteEmailError: string | null = null;
    try {
      await sendSchoolPortalInviteEmail({
        to: email,
        schoolName: name,
        loginUrl,
        expiresAt,
      });
      inviteEmailSent = true;
    } catch (err) {
      console.error("[admin/partner-schools] invite email", err);
      inviteEmailError =
        err instanceof Error ? err.message : "Failed to send invite email";
    }

    await invalidateSchoolsCache();

    return NextResponse.json(
      {
        ok: true,
        school: serializePartnerSchool({ ...doc, _id: result.insertedId }),
        schoolAdmin: { username: adminUsername, email: adminEmail },
        invite: {
          emailSent: inviteEmailSent,
          emailError: inviteEmailError,
          expiresAt: expiresAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[admin/partner-schools] POST", error);
    return NextResponse.json({ error: "Failed to create partner school" }, { status: 500 });
  }
}
