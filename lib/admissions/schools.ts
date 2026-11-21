import { ObjectId, type Collection, type Db } from "mongodb";
import type { SchoolDoc } from "./types";
import type { ProgrammeLevel } from "./programme-level";
import { isValidSlug, normalizeSlug, slugifySchoolName, isReservedSlug } from "./slug";
import {
  blendBrandColors,
  normalizeBrandColors,
} from "../brand-theme";
import { normalizeSchoolCategories } from "../schoolCategories";

export function schoolsCollection(db: Db): Collection<SchoolDoc> {
  return db.collection<SchoolDoc>("schools");
}

function finitePrice(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  return null;
}

export function effectiveVoucherPrice(
  school: Pick<
    SchoolDoc,
    | "voucherPrice"
    | "priceGhs"
    | "undergraduateVoucherPrice"
    | "postgraduateVoucherPrice"
  >,
  programmeLevel: ProgrammeLevel = "undergraduate",
): number | null {
  if (programmeLevel === "postgraduate") {
    const postgraduate = finitePrice(school.postgraduateVoucherPrice);
    if (postgraduate != null) return postgraduate;
  } else {
    const undergraduate = finitePrice(school.undergraduateVoucherPrice);
    if (undergraduate != null) return undergraduate;
  }

  const voucher = finitePrice(school.voucherPrice);
  if (voucher != null) return voucher;

  return finitePrice(school.priceGhs);
}

export function serializePartnerSchool(doc: SchoolDoc) {
  const categories = normalizeSchoolCategories(doc.categories, doc.category);
  const brandColors = normalizeBrandColors(doc.brandColors, doc.brandColor);
  const undergraduateVoucherPrice = effectiveVoucherPrice(doc, "undergraduate");
  const postgraduateVoucherPrice = effectiveVoucherPrice(doc, "postgraduate");
  return {
    id: String(doc._id),
    name: doc.name,
    alias: doc.alias ?? null,
    slug: doc.slug ?? null,
    logoSrc: doc.logoSrc ?? null,
    logoAlt: doc.logoAlt ?? null,
    email: doc.email ?? null,
    phone: doc.phone ?? null,
    address: doc.address ?? null,
    description: doc.description ?? doc.about ?? null,
    about: doc.about ?? null,
    priceGhs: doc.priceGhs ?? null,
    voucherPrice: undergraduateVoucherPrice,
    undergraduateVoucherPrice,
    postgraduateVoucherPrice,
    admissionFee:
      typeof doc.admissionFee === "number" && Number.isFinite(doc.admissionFee)
        ? doc.admissionFee
        : null,
    requiresVoucher: doc.requiresVoucher !== false,
    isActive: doc.isActive !== false,
    isPartner: !!doc.isPartner,
    isVerified: !!doc.isVerified,
    deadline: doc.deadline ? doc.deadline.toISOString() : null,
    brandColor: blendBrandColors(brandColors),
    brandColors,
    showBlogOnMain: doc.showBlogOnMain === true,
    categories: [...categories],
    category: categories[0] ?? "Public",
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : null,
  };
}

export async function ensureSchoolIndexes(db: Db): Promise<void> {
  const schools = schoolsCollection(db);
  await schools.createIndex({ slug: 1 }, { unique: true, sparse: true });
  await schools.createIndex({ isPartner: 1, isActive: 1 });
  await schools.createIndex({ name: 1 });
}

export async function findSchoolBySlug(
  db: Db,
  slug: string,
): Promise<SchoolDoc | null> {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;
  return schoolsCollection(db).findOne({ slug: normalized });
}

export async function findSchoolById(
  db: Db,
  id: string,
): Promise<SchoolDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  return schoolsCollection(db).findOne({ _id: new ObjectId(id) });
}

export async function listPartnerSchools(
  db: Db,
  options?: { activeOnly?: boolean },
): Promise<SchoolDoc[]> {
  const filter: Record<string, unknown> = { isPartner: true };
  if (options?.activeOnly) {
    filter.isActive = { $ne: false };
  }
  return schoolsCollection(db)
    .find(filter)
    .sort({ name: 1 })
    .limit(500)
    .toArray();
}

export async function allocateUniqueSlug(
  db: Db,
  nameOrSlug: string,
  excludeId?: ObjectId,
): Promise<string> {
  let base = normalizeSlug(nameOrSlug);
  if (!isValidSlug(base) || isReservedSlug(base)) {
    base = slugifySchoolName(nameOrSlug) || "school";
    if (isReservedSlug(base)) base = `school${base}`;
  }

  const schools = schoolsCollection(db);
  let candidate = base;
  let attempt = 0;

  while (attempt < 50) {
    const existing = await schools.findOne({
      slug: candidate,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });
    if (!existing) return candidate;
    attempt += 1;
    candidate = `${base}${attempt + 1}`.slice(0, 48);
  }

  return `${base}${Date.now().toString(36)}`.slice(0, 48);
}
