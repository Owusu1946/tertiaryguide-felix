"use client";

import React from "react";

export function Field({
  label,
  required,
  error,
  hint,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 text-sm ${className}`}>
      <span className="flex items-baseline gap-1 font-medium text-[#334155]">
        <span>{label}</span>
        {required ? (
          <span className="text-[11px] font-semibold text-[#EF4444]" aria-hidden>
            *
          </span>
        ) : null}
      </span>
      {children}
      {hint && !error ? (
        <span className="block text-xs leading-relaxed text-[#94A3B8]">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="block text-xs font-medium text-[#DC2626]">{error}</span>
      ) : null}
    </label>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="border-b border-[#EEF2F7] pb-4">
        <h3 className="text-base font-semibold tracking-tight text-[#0F172A]">
          {title}
        </h3>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#64748B]">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function FormNotice({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "warning" | "brand";
}) {
  const tones = {
    info: "border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    brand:
      "border-[color-mix(in_srgb,var(--school-brand,#007AFF)_22%,white)] bg-[var(--school-brand-soft,#EFF6FF)] text-[#1E3A5F]",
  } as const;
  return (
    <div
      className={`rounded-2xl border px-3.5 py-3 text-sm leading-relaxed ${tones[tone]}`}
    >
      {children}
    </div>
  );
}

export function FormCard({
  title,
  action,
  children,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#E8EEF5] bg-[#FCFCFD] p-4 sm:p-5">
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          {title ? (
            <div className="min-w-0 text-sm font-semibold text-[#0F172A]">
              {title}
            </div>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export const controlClass =
  "w-full rounded-xl border border-[#E2E8F0] bg-white px-3.5 py-2.5 text-sm text-[#0F172A] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] outline-none transition placeholder:text-[#94A3B8] hover:border-[#CBD5E1] focus:border-[var(--school-brand,#007AFF)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--school-brand,#007AFF)_14%,transparent)] disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]";

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean },
) {
  const { error, className = "", ...rest } = props;
  return (
    <input
      {...rest}
      className={`${controlClass} ${error ? "border-red-400 focus:border-red-400 focus:ring-red-100" : ""} ${className}`}
    />
  );
}

export function TextSelect(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean },
) {
  const { error, className = "", children, ...rest } = props;
  return (
    <select
      {...rest}
      className={`${controlClass} pr-9 ${error ? "border-red-400 focus:border-red-400 focus:ring-red-100" : ""} ${className}`}
    >
      {children}
    </select>
  );
}

export function TextTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean },
) {
  const { error, className = "", ...rest } = props;
  return (
    <textarea
      {...rest}
      className={`${controlClass} min-h-[96px] resize-y ${error ? "border-red-400 focus:border-red-400 focus:ring-red-100" : ""} ${className}`}
    />
  );
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search…",
  error,
  allowOther,
}: {
  options: readonly string[] | string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  allowOther?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q
      ? [...options]
      : options.filter((o) => o.toLowerCase().includes(q));
    return list.slice(0, 40);
  }, [options, query]);

  return (
    <div className="relative">
      <TextInput
        error={error}
        value={open ? query : value}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setQuery(value);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (allowOther) onChange(e.target.value);
        }}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150);
        }}
      />
      {open && (
        <ul className="absolute z-20 mt-1.5 max-h-56 w-full overflow-auto rounded-xl border border-[#E2E8F0] bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
          {filtered.length === 0 ? (
            <li className="px-3 py-2.5 text-xs text-[#94A3B8]">No matches</li>
          ) : (
            filtered.map((opt) => (
              <li key={opt}>
                <button
                  type="button"
                  className={`w-full px-3 py-2.5 text-left text-sm transition hover:bg-[var(--school-brand-soft,#EFF6FF)] ${
                    opt === value
                      ? "bg-[var(--school-brand-soft,#EFF6FF)] font-medium text-[var(--school-brand,#007AFF)]"
                      : "text-[#0F172A]"
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(opt);
                    setQuery(opt);
                    setOpen(false);
                  }}
                >
                  {opt}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
