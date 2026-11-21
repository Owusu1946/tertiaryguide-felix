"use client";

import type { ProgrammeLevel } from "@/lib/admissions/programme-level";

export type ProgrammeLevelFilterValue = "all" | ProgrammeLevel;

type SchoolPriceFields = {
  priceGhs?: number | null;
  undergraduateVoucherPrice?: number | null;
  postgraduateVoucherPrice?: number | null;
};

const OPTIONS: { value: ProgrammeLevelFilterValue; label: string }[] = [
  { value: "all", label: "All levels" },
  { value: "undergraduate", label: "Undergraduate" },
  { value: "postgraduate", label: "Postgraduate" },
];

export function priceForProgrammeLevel(
  school: SchoolPriceFields,
  level: ProgrammeLevelFilterValue,
): number | null {
  if (level === "postgraduate") {
    return typeof school.postgraduateVoucherPrice === "number" &&
      Number.isFinite(school.postgraduateVoucherPrice)
      ? school.postgraduateVoucherPrice
      : null;
  }
  if (
    typeof school.undergraduateVoucherPrice === "number" &&
    Number.isFinite(school.undergraduateVoucherPrice)
  ) {
    return school.undergraduateVoucherPrice;
  }
  return typeof school.priceGhs === "number" && Number.isFinite(school.priceGhs)
    ? school.priceGhs
    : null;
}

/** Schools without an explicit postgraduate price only appear under All / Undergraduate. */
export function schoolMatchesProgrammeLevel(
  school: SchoolPriceFields,
  level: ProgrammeLevelFilterValue,
): boolean {
  if (level === "all") return true;
  if (level === "postgraduate") {
    return priceForProgrammeLevel(school, "postgraduate") != null;
  }
  return priceForProgrammeLevel(school, "undergraduate") != null;
}

export function ProgrammeLevelFilter({
  value,
  onChange,
}: {
  value: ProgrammeLevelFilterValue;
  onChange: (next: ProgrammeLevelFilterValue) => void;
}) {
  return (
    <div
      className="flex w-full gap-2 overflow-x-auto overscroll-x-contain scroll-pb-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Filter by programme level"
    >
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={`shrink-0 rounded-full px-3 py-2 text-xs font-medium transition [touch-action:manipulation] active:scale-[0.98] sm:text-sm ${
              selected
                ? "bg-[#007AFF] text-white shadow-sm hover:bg-[#0066D6]"
                : "bg-gray-100/80 text-[#555555] hover:text-[#007AFF]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
