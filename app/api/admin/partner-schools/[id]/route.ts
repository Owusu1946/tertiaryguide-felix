import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../../lib/mongodb";
import { requireStaff } from "../../../../../lib/admin-access";
import { invalidateSchoolsCache } from "../../../../../lib/redis";
import {
  allocateUniqueSlug,
  findSchoolById,
  schoolsCollection,
  serializePartnerSchool,
} from "../../../../../lib/admissions/schools";
import { normalizeSlug } from "../../../../../lib/admissions/slug";
import { normalizeBrandColor } from "../../../../../lib/brand-theme";
import { schoolCategoriesFromRequestBody } from "../../../../../lib/schoolCategories";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireStaff(req);
  if ("response" in auth) return auth.response;

  const { id } = await ctx.params;
  const db = await getDb();
  const school = await findSchoolById(db, id);
  if (!school || !school.isPartner) {
    return NextResponse.json({ error: "Partner school not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, school: serializePartnerSchool(school) });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireStaff(req);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid school id" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const db = await getDb();
    const existing = await findSchoolById(db, id);
    if (!existing || !existing.isPartner) {
      return NextResponse.json({ error: "Partner school not found" }, { status: 404 });
    }

    const $set: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof body?.name === "string" && body.name.trim()) {
      $set.name = body.name.trim();
    }
    if (typeof body?.alias === "string") $set.alias = body.alias.trim() || null;
    if (body?.alias === null) $set.alias = null;
    if (typeof body?.email === "string") $set.email = body.email.trim().toLowerCase() || null;
    if (typeof body?.phone === "string") $set.phone = body.phone.trim() || null;
    if (typeof body?.address === "string") $set.address = body.address.trim() || null;
    if (typeof body?.description === "string") {
      $set.description = body.description.trim() || null;
      $set.about = body.description.trim() || null;
    }
    if (typeof body?.logoSrc === "string") $set.logoSrc = body.logoSrc.trim() || null;
    if (body?.logoSrc === null) $set.logoSrc = null;
    if (typeof body?.logoAlt === "string") $set.logoAlt = body.logoAlt.trim() || null;
    if (typeof body?.requiresVoucher === "boolean") $set.requiresVoucher = body.requiresVoucher;
    if (typeof body?.isActive === "boolean") $set.isActive = body.isActive;
    if (typeof body?.isVerified === "boolean") $set.isVerified = body.isVerified;
    if (typeof body?.showBlogOnMain === "boolean") {
      $set.showBlogOnMain = body.showBlogOnMain;
    }

    if (body?.voucherPrice !== undefined) {
      const n = Number(body.voucherPrice);
      const price = Number.isFinite(n) && n >= 0 ? n : null;
      $set.voucherPrice = price;
      $set.priceGhs = price;
    }
    if (body?.admissionFee !== undefined) {
      const n = Number(body.admissionFee);
      $set.admissionFee = Number.isFinite(n) && n >= 0 ? n : null;
    }
    if (typeof body?.slug === "string" && body.slug.trim()) {
      $set.slug = await allocateUniqueSlug(
        db,
        normalizeSlug(body.slug),
        existing._id,
      );
    }
    if (body?.deadline !== undefined) {
      if (body.deadline === null || body.deadline === "") {
        $set.deadline = null;
      } else if (typeof body.deadline === "string") {
        const d = new Date(body.deadline);
        $set.deadline = Number.isNaN(d.getTime()) ? null : d;
      }
    }
    if (typeof body?.brandColor === "string" || body?.brandColor === null) {
      $set.brandColor =
        body.brandColor === null || body.brandColor === ""
          ? null
          : normalizeBrandColor(body.brandColor);
    }
    if (
      Array.isArray(body?.categories) ||
      typeof body?.category === "string"
    ) {
      const categories = schoolCategoriesFromRequestBody(body);
      $set.categories = [...categories];
    }

    const updateOp: {
      $set: Record<string, unknown>;
      $unset?: { category: "" };
    } = { $set };
    if ($set.categories) {
      updateOp.$unset = { category: "" };
    }

    await schoolsCollection(db).updateOne(
      { _id: new ObjectId(id) },
      // Mongo $unset values are "" | 1 | true; SchoolDoc typing is stricter here.
      updateOp as never,
    );
    await invalidateSchoolsCache();

    const updated = await findSchoolById(db, id);
    return NextResponse.json({
      ok: true,
      school: updated ? serializePartnerSchool(updated) : null,
    });
  } catch (error) {
    console.error("[admin/partner-schools/:id] PATCH", error);
    return NextResponse.json({ error: "Failed to update school" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireStaff(req);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid school id" }, { status: 400 });
    }

    const db = await getDb();
    const existing = await findSchoolById(db, id);
    if (!existing || !existing.isPartner) {
      return NextResponse.json({ error: "Partner school not found" }, { status: 404 });
    }

    const schoolObjectId = new ObjectId(id);
    const schoolIdStr = id;

    // Permanently remove partner school and related admissions data
    await Promise.all([
      schoolsCollection(db).deleteOne({ _id: schoolObjectId }),
      db.collection("users").deleteMany({
        role: "school_admin",
        schoolId: schoolObjectId,
      }),
      db.collection("admissionProgrammes").deleteMany({ schoolId: schoolObjectId }),
      db.collection("applicationDrafts").deleteMany({ schoolId: schoolObjectId }),
      db.collection("admissionVouchers").deleteMany({ schoolId: schoolObjectId }),
      db.collection("admissionPayments").deleteMany({ schoolId: schoolObjectId }),
      db.collection("applications").deleteMany({ schoolId: schoolObjectId }),
      db.collection("blogPosts").deleteMany({ schoolId: schoolIdStr }),
    ]);

    await invalidateSchoolsCache();

    return NextResponse.json({
      ok: true,
      deleted: true,
      schoolId: schoolIdStr,
      name: existing.name,
    });
  } catch (error) {
    console.error("[admin/partner-schools/:id] DELETE", error);
    return NextResponse.json({ error: "Failed to delete school" }, { status: 500 });
  }
}
