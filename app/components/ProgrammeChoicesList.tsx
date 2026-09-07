"use client";

import type { RankedProgrammeChoice } from "@/lib/admissions/programme-choices";

const RANK_STYLES = [
  "bg-[#007AFF] text-white shadow-sm shadow-[#007AFF]/20",
  "bg-[#EEF2FF] text-[#3730A3]",
  "bg-[#F1F5F9] text-[#334155]",
  "bg-white text-[#64748B] ring-1 ring-[#E2E8F0]",
];

export function ProgrammeChoicesList({
  programmes,
  emptyLabel = "No programme selected yet.",
  title,
  columns = 2,
}: {
  programmes: RankedProgrammeChoice[];
  emptyLabel?: string;
  title?: string;
  columns?: 2 | 4;
}) {
  const gridClass =
    columns === 4
      ? "grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 xl:grid-cols-4"
      : "grid grid-cols-1 gap-3 sm:grid-cols-2";

  return (
    <div className="min-w-0">
      {title ? (
        <h3 className="mb-3 text-sm font-semibold tracking-tight text-[#0F172A]">
          {title}
        </h3>
      ) : null}
      {programmes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4 text-sm text-[#64748B]">
          {emptyLabel}
        </p>
      ) : (
        <ol className={gridClass}>
          {programmes.map((item) => (
            <li
              key={`${item.rank}-${item.display}`}
              className="flex h-full min-h-[100px] items-start gap-3 rounded-2xl border border-white bg-white px-3.5 py-3.5 shadow-[0_5px_16px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  RANK_STYLES[item.rank - 1] || RANK_STYLES[3]
                }`}
              >
                {item.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
                  {item.label}
                </p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-[#0F172A]">
                  {item.programme}
                </p>
                {item.stream ? (
                  <p className="mt-0.5 truncate text-xs text-[#64748B]">
                    {item.stream}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
