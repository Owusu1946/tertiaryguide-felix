"use client";

import React, { useCallback, useRef, useState } from "react";
import { FileUp, Loader2, X } from "lucide-react";

type Props = {
  label: string;
  required?: boolean;
  accept: string;
  maxMb: number;
  value?: string;
  error?: string;
  preview?: "photo" | "file";
  onUploaded: (url: string) => void;
  onClear: () => void;
};

function isImageUrl(url: string) {
  if (!url) return false;
  if (url.startsWith("data:image/")) return true;
  if (/\.pdf(\?|#|$)/i.test(url) || url.includes("/raw/upload/")) return false;
  if (/\/image\/upload\//.test(url)) return true;
  return /\.(jpe?g|png|gif|webp|avif)(\?|#|$)/i.test(url);
}

export function FileDropzone({
  label,
  required,
  accept,
  maxMb,
  value,
  error,
  preview = "file",
  onUploaded,
  onClear,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      setLocalError(null);
      const allowed = accept.split(",").map((s) => s.trim().toLowerCase());
      const ext = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
      const typeOk =
        allowed.some((a) => a === file.type || a === ext) ||
        allowed.some(
          (a) =>
            a.endsWith("/*") && file.type.startsWith(a.replace("/*", "/")),
        );

      if (!typeOk) {
        setLocalError(`Invalid file type. Allowed: ${accept}`);
        return;
      }
      if (file.size > maxMb * 1024 * 1024) {
        setLocalError(`File must be ${maxMb}MB or smaller`);
        return;
      }

      setBusy(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/apply/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok || !data.url) {
          throw new Error(data.error || "Upload failed");
        }
        onUploaded(data.url);
      } catch (e) {
        setLocalError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setBusy(false);
      }
    },
    [accept, maxMb, onUploaded],
  );

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-[#334155]">
        {label}
        {required ? (
          <span className="text-[11px] font-semibold text-[#EF4444]"> *</span>
        ) : null}
      </p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void upload(file);
        }}
        className={`rounded-2xl border border-dashed px-4 py-7 text-center transition ${
          dragging
            ? "border-[var(--school-brand,#007AFF)] bg-[var(--school-brand-soft,#EFF6FF)]"
            : error || localError
              ? "border-red-300 bg-red-50/50"
              : "border-[#D6DEE8] bg-[#F8FAFC] hover:border-[#B6C3D4] hover:bg-white"
        }`}
      >
        {value ? (
          <div className="space-y-3">
            {preview === "photo" || isImageUrl(value) ? (
              <div
                className={`mx-auto overflow-hidden border border-[#111827] bg-white ${
                  preview === "photo"
                    ? "h-40 w-32"
                    : "h-28 w-full max-w-[220px] rounded-xl"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={value}
                  alt={label}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}
            <div className="flex items-center justify-center gap-2">
              <a
                href={value}
                target="_blank"
                rel="noreferrer"
                className="truncate text-sm text-[var(--school-brand,#007AFF)] underline"
              >
                {isImageUrl(value) ? "View photo" : "Uploaded file ✓"}
              </a>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium text-[#334155]"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs text-[#64748B]"
              >
                <X className="h-3 w-3" /> Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex w-full flex-col items-center gap-2 text-sm text-[#64748B]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[var(--school-brand,#007AFF)] shadow-sm ring-1 ring-[#E8EEF5]">
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <FileUp className="h-5 w-5" />
              )}
            </span>
            <span className="font-medium text-[#334155]">
              {busy ? "Uploading…" : "Drag & drop or click to upload"}
            </span>
            <span className="text-xs text-[#94A3B8]">
              Max {maxMb}MB · {accept.split(",").join(" · ")}
            </span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>
      {(localError || error) && (
        <p className="text-xs font-medium text-[#DC2626]">
          {localError || error}
        </p>
      )}
    </div>
  );
}
