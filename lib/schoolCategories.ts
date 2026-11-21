export const SCHOOL_CATEGORIES = [
  "Public",
  "Private",
  "Training College",
  "TVET",
  "Nursing",
] as const;

export type SchoolCategory = (typeof SCHOOL_CATEGORIES)[number];

const SET = new Set<string>(SCHOOL_CATEGORIES);
const ORDER = new Map(SCHOOL_CATEGORIES.map((c, i) => [c, i]));

/** Maps legacy/unknown values to a valid category (default Public). */
export function normalizeSchoolCategory(
  raw: string | null | undefined,
): SchoolCategory {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (SET.has(s)) return s as SchoolCategory;
  return "Public";
}

/**
 * Produces a non-empty, de-duplicated list in standard order.
 * Uses legacy single `category` when `categories` is missing or empty.
 */
export function normalizeSchoolCategories(
  raw: unknown,
  legacySingle?: string | null,
): SchoolCategory[] {
  const out: SchoolCategory[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item !== "string") continue;
      const c = normalizeSchoolCategory(item);
      if (!seen.has(c)) {
        seen.add(c);
        out.push(c);
      }
    }
  }
  if (out.length === 0) {
    out.push(normalizeSchoolCategory(legacySingle));
  }
  return out.sort(
    (a, b) => (ORDER.get(a) ?? 0) - (ORDER.get(b) ?? 0),
  );
}

export function schoolCategoriesFromRequestBody(body: {
  categories?: unknown;
  category?: unknown;
} | null | undefined): SchoolCategory[] {
  if (!body) return ["Public"];
  if (Array.isArray(body.categories) && body.categories.length > 0) {
    return normalizeSchoolCategories(body.categories, null);
  }
  if (typeof body.category === "string" && body.category.trim() !== "") {
    return normalizeSchoolCategories([body.category], null);
  }
  if (Array.isArray(body.categories) && body.categories.length === 0) {
    return ["Public"];
  }
  return ["Public"];
}

/** First category, for legacy single-field consumers. */
export function primarySchoolCategory(
  categories: SchoolCategory[],
): SchoolCategory {
  return categories[0] ?? "Public";
}
