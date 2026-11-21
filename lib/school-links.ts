function withProgrammeLevel(
  href: string,
  programmeLevel?: "undergraduate" | "postgraduate" | "all" | null,
) {
  if (
    programmeLevel !== "undergraduate" &&
    programmeLevel !== "postgraduate"
  ) {
    return href;
  }
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}level=${programmeLevel}`;
}

export function catalogSchoolHref(
  school: {
    id: string;
    isPartner?: boolean;
    slug?: string | null;
  },
  programmeLevel?: "undergraduate" | "postgraduate" | "all" | null,
) {
  if (school.isPartner) {
    const base = school.slug
      ? `/apply/school/${encodeURIComponent(school.slug)}`
      : `/apply?school=${encodeURIComponent(school.id)}`;
    return withProgrammeLevel(base, programmeLevel);
  }
  return withProgrammeLevel(
    `/university-forms/${school.id}`,
    programmeLevel,
  );
}

/** Partner/secured school — buy voucher / admission form for that school. */
export function partnerSchoolBuyFormsHref(
  school: {
    id: string;
    slug?: string | null;
  },
  programmeLevel?: "undergraduate" | "postgraduate" | "all" | null,
) {
  const base = school.slug
    ? `/apply/school/${encodeURIComponent(school.slug)}`
    : `/apply?school=${encodeURIComponent(school.id)}&step=voucher`;
  return withProgrammeLevel(base, programmeLevel);
}

/** Programme search / compare — public and secured schools use the same comparison page. */
export function programmeCompareHref(programme: {
  id: string;
  source?: string | null;
}) {
  const params = new URLSearchParams({ programmeId: programme.id });
  if (programme.source === "partner") params.set("source", "partner");
  return `/program-search/compare?${params.toString()}`;
}
