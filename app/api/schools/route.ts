import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../lib/mongodb";
import { type CachedSchool } from "../../../lib/redis";
import {
  normalizeSchoolCategories,
  primarySchoolCategory,
} from "../../../lib/schoolCategories";
import { effectiveVoucherPrice } from "../../../lib/admissions/schools";
import { compareDeadlineForListing } from "../../../lib/deadlines";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface SchoolDoc {
  _id?: ObjectId;
  name: string;
  alias?: string | null;
  slug?: string | null;
  logoSrc?: string | null;
  logoAlt?: string | null;
  priceGhs?: number | null;
  voucherPrice?: number | null;
  undergraduateVoucherPrice?: number | null;
  postgraduateVoucherPrice?: number | null;
  deadline?: Date | null;
  createdAt: Date;
  about?: string | null;
  preRequisite?: string | null;
  durationYears?: number | null;
  isVerified?: boolean;
  isPartner?: boolean;
  isActive?: boolean;
  category?: string | null;
  categories?: string[] | null;
}

export async function GET(_req: NextRequest) {
  try {
    const db = await getDb();
    const schools = db.collection<SchoolDoc>("schools");

    const docs = await schools
      .find(
        {
          $or: [
            { isPartner: { $ne: true } },
            { isPartner: true, isActive: { $ne: false } },
          ],
        },
        { sort: { createdAt: -1 } },
      )
      .limit(300)
      .toArray();

    const items: CachedSchool[] = docs.map((doc) => {
      const categories = normalizeSchoolCategories(
        doc.categories,
        doc.category,
      );
      const isPartner = doc.isPartner === true;
      const undergraduateVoucherPrice = isPartner
        ? effectiveVoucherPrice(doc, "undergraduate")
        : typeof doc.priceGhs === "number"
          ? doc.priceGhs
          : null;
      const postgraduateVoucherPrice =
        typeof doc.postgraduateVoucherPrice === "number" &&
        Number.isFinite(doc.postgraduateVoucherPrice)
          ? doc.postgraduateVoucherPrice
          : null;
      const price = undergraduateVoucherPrice;
      return {
        id: String(doc._id),
        name: doc.name,
        alias: doc.alias ?? null,
        slug: doc.slug ?? null,
        logoSrc: doc.logoSrc ?? null,
        logoAlt: doc.logoAlt ?? null,
        priceGhs: price,
        undergraduateVoucherPrice,
        postgraduateVoucherPrice,
        deadline: doc.deadline ? doc.deadline.toISOString() : null,
        about: doc.about ?? null,
        preRequisite: doc.preRequisite ?? null,
        durationYears: doc.durationYears ?? null,
        isVerified: isPartner || !!doc.isVerified,
        isPartner,
        categories: [...categories],
        category: primarySchoolCategory(categories),
      };
    });

    items.sort((a, b) => {
      const byDeadline = compareDeadlineForListing(a.deadline, b.deadline);
      if (byDeadline !== 0) return byDeadline;
      if (Boolean(a.isPartner) !== Boolean(b.isPartner)) {
        return a.isPartner ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json(
      { ok: true, schools: items },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("[schools] GET error", error);
    return NextResponse.json(
      { error: "Failed to load schools" },
      { status: 500 },
    );
  }
}
