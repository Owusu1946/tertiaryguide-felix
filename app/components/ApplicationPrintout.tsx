"use client";

import type { CSSProperties } from "react";
import {
  mixBrandWithWhite,
  normalizeBrandColors,
} from "@/lib/brand-theme";
import {
  academicYearLabel,
  type ApplicationPrintoutData,
  type ApplicationPrintoutSchool,
  type PrintField,
} from "@/lib/admissions/printout-data";
import {
  DECLARATION_CERTIFY,
  DECLARATION_FALSEHOOD,
  DECLARATION_HEADING,
  DECLARATION_IMPORTANT_BODY,
  DECLARATION_IMPORTANT_HEADING,
  DECLARATION_PERMISSION_AFTER,
  DECLARATION_PERMISSION_BEFORE,
  certificateNameOrder,
  declarationSchoolLabel,
  declarationSignedParts,
} from "@/lib/admissions/declaration";

export {
  academicYearLabel,
  printoutFromDetail,
  printoutFromForm,
  type ApplicationPrintoutData,
  type ApplicationPrintoutSchool,
  type PrintField,
} from "@/lib/admissions/printout-data";

function FieldList({ rows }: { rows: PrintField[] }) {
  if (rows.length === 0) {
    return <p className="text-[12px] italic text-[#64748B]">Not provided yet.</p>;
  }
  return (
    <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
      {rows.map((row) => (
        <div
          key={`${row.label}-${row.value}`}
          className="grid grid-cols-[minmax(110px,42%)_1fr] gap-x-2 border-b border-[#E5E7EB] py-[5px] text-[12px] leading-snug"
        >
          <dt className="text-[#334155]">{row.label}:</dt>
          <dd className="font-bold uppercase tracking-[0.02em] text-[#111827]">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function printFieldValue(rows: PrintField[], label: string) {
  return rows.find((row) => row.label === label)?.value || "";
}

function certificateNameFromPrintout(data: ApplicationPrintoutData) {
  return certificateNameOrder({
    title: printFieldValue(data.personal, "Title"),
    surname: printFieldValue(data.personal, "Surname"),
    firstName: printFieldValue(data.personal, "Firstname"),
    middleName: printFieldValue(data.personal, "Middle Names"),
  });
}

function SectionTitle({
  children,
  brand,
  soft,
}: {
  children: string;
  brand: string;
  soft: string;
}) {
  return (
    <span
      className="mb-3 inline-block border px-2 py-1 text-[11px] font-bold uppercase tracking-wide"
      style={{ borderColor: brand, color: brand, background: soft }}
    >
      {children}
    </span>
  );
}

function PassportPhoto({
  src,
  brand,
}: {
  src?: string | null;
  brand: string;
}) {
  return (
    <div className="w-[7.5rem] shrink-0 text-center sm:w-32">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt="Passport photograph"
          className="mx-auto h-36 w-[7.5rem] border border-[#111827] bg-[#F8FAFC] object-cover sm:h-40 sm:w-32"
        />
      ) : (
        <div className="mx-auto flex h-36 w-[7.5rem] items-center justify-center border border-dashed border-[#94A3B8] bg-[#F8FAFC] px-2 text-center text-[10px] text-[#64748B] sm:h-40 sm:w-32">
          Passport photograph
        </div>
      )}
      <p className="mt-1.5 text-[9px] font-semibold leading-tight text-[#B91C1C]">
        Is this your correct passport-size photograph?
      </p>
      <p className="mt-1 text-[9px] font-semibold leading-tight text-[#15803D]">
        Proceed if your answer is YES.
      </p>
      <p className="mt-1 text-[9px] font-semibold leading-tight text-[#B91C1C]">
        You could be denied admission if you upload an inappropriate photograph.
      </p>
      <p
        className="mt-1 text-[9px] font-semibold leading-tight"
        style={{ color: brand }}
      >
        This shall be used in producing your ID card upon registration.
      </p>
    </div>
  );
}

export function ApplicationPrintout({
  school,
  data,
}: {
  school: ApplicationPrintoutSchool;
  data: ApplicationPrintoutData;
}) {
  const colors = normalizeBrandColors(school.brandColors, school.brandColor);
  const brand = colors[0] ?? "#007AFF";
  const soft = mixBrandWithWhite(brand, 0.88);
  const year = academicYearLabel();
  const printed = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <article
      className="relative overflow-hidden rounded-sm border border-[#D1D5DB] bg-white px-5 py-6 text-[#111827] shadow-sm sm:px-8 sm:py-8"
      style={
        {
          "--print-brand": brand,
          "--print-brand-soft": soft,
        } as CSSProperties
      }
    >
      {school.logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={school.logoSrc}
          alt=""
          className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-auto max-w-[70%] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.06]"
        />
      ) : null}

      <header className="relative z-10 flex items-start justify-between gap-4 border-b border-[#D1D5DB] pb-4">
        <div className="flex min-w-0 items-start gap-3">
          {school.logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={school.logoSrc}
              alt=""
              className="h-16 w-16 shrink-0 object-contain sm:h-[72px] sm:w-[72px]"
            />
          ) : null}
          <div className="min-w-0">
            <h2 className="text-[15px] font-extrabold uppercase leading-tight tracking-wide sm:text-lg">
              {school.name}
            </h2>
            <p
              className="mt-1 text-[12px] font-semibold sm:text-sm"
              style={{ color: brand }}
            >
              Online Application Form{" "}
              <span className="font-extrabold">
                {year} Academic Year ONLY
              </span>
            </p>
          </div>
        </div>
        <div className="max-w-[220px] shrink-0 text-right text-[10px] leading-relaxed text-[#475569]">
          {school.address ? <p>{school.address}</p> : null}
          {school.phone ? <p>{school.phone}</p> : null}
          {school.email ? <p>{school.email}</p> : null}
          <p className="mt-1">{printed}</p>
        </div>
      </header>

      <p
        className="relative z-10 mt-3 text-center text-[12px] font-semibold"
        style={{ color: brand }}
      >
        Keep a copy of this printout for any future enquiry.
      </p>

      <section className="relative z-10 mt-5 border-t border-[#D1D5DB] pt-4">
        <div className="flex items-start gap-4 sm:gap-6">
          <div className="min-w-0 flex-1">
            <SectionTitle brand={brand} soft={soft}>
              Personal Information
            </SectionTitle>
            <p className="mb-3 text-[11px] font-bold" style={{ color: brand }}>
              NB: The name and its arrangement on this application MUST be
              EXACTLY the same as on your certificate / result slip.
            </p>
            <FieldList rows={data.personal} />
          </div>
          <PassportPhoto src={data.photoUrl} brand={brand} />
        </div>
      </section>

      <section className="relative z-10 mt-5 border-t border-[#D1D5DB] pt-4">
        <SectionTitle brand={brand} soft={soft}>
          Guardians Information
        </SectionTitle>
        <FieldList rows={data.guardian} />
      </section>

      <section className="relative z-10 mt-5 border-t border-[#D1D5DB] pt-4">
        <SectionTitle brand={brand} soft={soft}>
          Programme Choices
        </SectionTitle>
        {data.programmes.length === 0 ? (
          <p className="text-[12px] italic text-[#64748B]">
            No programme choices yet.
          </p>
        ) : (
          <table className="w-full border-collapse text-left text-[12px]">
            <thead>
              <tr style={{ background: soft, color: brand }}>
                <th className="border border-[#D1D5DB] px-2 py-1.5 font-bold">
                  Choice
                </th>
                <th className="border border-[#D1D5DB] px-2 py-1.5 font-bold">
                  Programme
                </th>
                <th className="border border-[#D1D5DB] px-2 py-1.5 font-bold">
                  Stream
                </th>
              </tr>
            </thead>
            <tbody>
              {data.programmes.map((row) => (
                <tr key={`${row.choice}-${row.programme}`}>
                  <td className="border border-[#D1D5DB] px-2 py-1.5">
                    {row.choice}
                  </td>
                  <td className="border border-[#D1D5DB] px-2 py-1.5 font-bold uppercase">
                    {row.programme}
                  </td>
                  <td className="border border-[#D1D5DB] px-2 py-1.5 uppercase">
                    {row.stream || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="relative z-10 mt-5 border-t border-[#D1D5DB] pt-4">
        {data.educations.map((record) => (
          <div key={record.heading} className="mt-4 first:mt-0">
            <SectionTitle brand={brand} soft={soft}>
              {record.heading}
            </SectionTitle>
            <FieldList rows={record.rows} />
          </div>
        ))}
      </section>

      <section className="relative z-10 mt-5 border-t border-[#D1D5DB] pt-4">
        {data.examinations.map((sitting) => (
          <div key={sitting.heading} className="mt-4 first:mt-0">
            <SectionTitle brand={brand} soft={soft}>
              {sitting.heading}
            </SectionTitle>
            <FieldList rows={sitting.rows} />
            {sitting.results.length > 0 ? (
              <table className="mt-3 w-full border-collapse text-left text-[12px]">
                <thead>
                  <tr style={{ background: soft, color: brand }}>
                    <th className="border border-[#D1D5DB] px-2 py-1.5 font-bold">
                      Subject
                    </th>
                    <th className="border border-[#D1D5DB] px-2 py-1.5 font-bold">
                      Grade
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sitting.results.map((row) => (
                    <tr key={`${sitting.heading}-${row.subject}-${row.grade}`}>
                      <td className="border border-[#D1D5DB] px-2 py-1.5 uppercase">
                        {row.subject}
                      </td>
                      <td className="border border-[#D1D5DB] px-2 py-1.5 font-bold">
                        {row.grade}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        ))}
      </section>

      <section className="relative z-10 mt-5 border-t border-[#D1D5DB] pt-4">
        <p className="text-[12px] font-bold uppercase tracking-wide text-[#B91C1C]">
          {DECLARATION_IMPORTANT_HEADING}
        </p>
        <p className="mt-2 text-[12px] font-semibold leading-relaxed text-[#B91C1C]">
          {DECLARATION_IMPORTANT_BODY}
        </p>
        <div className="mt-4">
          <SectionTitle brand={brand} soft={soft}>
            {DECLARATION_HEADING}
          </SectionTitle>
          <div className="space-y-3 text-[12px] leading-relaxed text-[#334155]">
            <p>{DECLARATION_CERTIFY}</p>
            <p>
              {DECLARATION_PERMISSION_BEFORE}
              <strong className="font-bold text-[#111827]">
                {declarationSchoolLabel(school.name)}
              </strong>
              {DECLARATION_PERMISSION_AFTER}
            </p>
            <p>{DECLARATION_FALSEHOOD}</p>
            <p className="font-semibold text-[#111827]">
              {(() => {
                const signed = declarationSignedParts(
                  certificateNameFromPrintout(data),
                );
                return (
                  <>
                    {signed.before}
                    {signed.name}{" "}
                    <span className="font-semibold text-[#B91C1C]">
                      {signed.hint}
                    </span>
                    {signed.after}
                  </>
                );
              })()}
            </p>
          </div>
        </div>
      </section>
    </article>
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlFields(rows: PrintField[]) {
  if (!rows.length) return `<p class="muted">Not provided yet.</p>`;
  return `<dl class="grid">${rows
    .map(
      (row) =>
        `<div><dt>${escapeHtml(row.label)}:</dt><dd>${escapeHtml(row.value)}</dd></div>`,
    )
    .join("")}</dl>`;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function inlineRemoteImages(html: string) {
  const urls = [
    ...new Set(
      [...html.matchAll(/\bsrc="(https?:[^"]+)"/g)].map((match) => match[1]),
    ),
  ];
  const replacements = await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url, { mode: "cors" });
        if (!res.ok) return null;
        const dataUrl = await blobToDataUrl(await res.blob());
        return { url, dataUrl };
      } catch {
        return null;
      }
    }),
  );
  let next = html;
  for (const item of replacements) {
    if (!item) continue;
    next = next.split(item.url).join(item.dataUrl);
  }
  return next;
}

function waitForImages(root: Document | HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  );
}

function buildPrintoutHtml(opts: {
  school: ApplicationPrintoutSchool;
  data: ApplicationPrintoutData;
}) {
  const { school, data } = opts;
  const colors = normalizeBrandColors(school.brandColors, school.brandColor);
  const brand = colors[0] ?? "#007AFF";
  const soft = mixBrandWithWhite(brand, 0.88);
  const year = academicYearLabel();
  const printed = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const number = data.applicationNumber || "application";
  const photo = data.photoUrl
    ? `<img class="photo" src="${escapeHtml(data.photoUrl)}" alt="Passport photograph" />`
    : `<div class="photo empty">Passport photograph</div>`;
  const photoBlock = `<div class="photo-wrap">${photo}
    <p class="warn">Is this your correct passport-size photograph?</p>
    <p class="ok">Proceed if your answer is YES.</p>
    <p class="warn">You could be denied admission if you upload an inappropriate photograph.</p>
    <p class="idnote">This shall be used in producing your ID card upon registration.</p>
  </div>`;
  const logo = school.logoSrc
    ? `<img class="logo" src="${escapeHtml(school.logoSrc)}" alt="" />`
    : "";
  const watermark = school.logoSrc
    ? `<img class="watermark" src="${escapeHtml(school.logoSrc)}" alt="" />`
    : "";

  return {
    number,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(school.name)} — ${escapeHtml(number)}</title>
  <style>
    html, body { margin: 0; background: #fff; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111827; }
    .sheet { position: relative; width: 794px; margin: 0; padding: 24px 28px 32px; box-sizing: border-box; background: #fff; }
    .watermark { position: absolute; left: 50%; top: 42%; width: 58%; transform: translate(-50%,-50%); opacity: .07; }
    header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid #d1d5db; padding-bottom: 12px; }
    .brand { display: flex; gap: 12px; align-items: flex-start; }
    .logo { width: 72px; height: 72px; object-fit: contain; }
    h1 { font-size: 18px; margin: 0; text-transform: uppercase; }
    .subtitle { color: ${brand}; font-size: 13px; font-weight: 700; margin: 6px 0 0; }
    .contact { font-size: 10px; color: #475569; text-align: right; max-width: 220px; }
    .keep { text-align: center; color: ${brand}; font-weight: 700; font-size: 12px; margin: 12px 0 0; }
    section { border-top: 1px solid #d1d5db; margin-top: 16px; padding-top: 12px; position: relative; }
    .box { display: inline-block; border: 1px solid ${brand}; color: ${brand}; background: ${soft}; font-size: 11px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; padding: 4px 8px; }
    .personal { display: flex; gap: 20px; align-items: flex-start; }
    .personal-body { flex: 1; min-width: 0; }
    .photo-wrap { width: 128px; flex-shrink: 0; text-align: center; }
    .photo { width: 128px; height: 160px; object-fit: cover; border: 1px solid #111827; }
    .photo.empty { display: flex; align-items: center; justify-content: center; font-size: 10px; color: #64748b; border: 1px dashed #94a3b8; text-align: center; padding: 8px; }
    .photo-wrap p { margin: 6px 0 0; font-size: 8px; font-weight: 700; line-height: 1.3; }
    .warn { color: #b91c1c; }
    .ok { color: #15803d; }
    .idnote { color: ${brand}; }
    .nb { color: ${brand}; font-size: 11px; font-weight: 800; }
    dl.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
    dl.grid > div { display: grid; grid-template-columns: 42% 1fr; gap: 8px; border-bottom: 1px solid #e5e7eb; padding: 5px 0; }
    dt { font-size: 12px; color: #334155; }
    dd { margin: 0; font-size: 12px; font-weight: 800; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th { background: ${soft}; color: ${brand}; text-align: left; }
    th, td { border: 1px solid #d1d5db; padding: 6px 8px; }
    td.prog { font-weight: 800; text-transform: uppercase; }
    .muted { font-size: 12px; font-style: italic; color: #64748b; }
  </style>
</head>
<body>
  <div class="sheet">
    ${watermark}
    <header>
      <div class="brand">${logo}<div>
        <h1>${escapeHtml(school.name)}</h1>
        <p class="subtitle">Online Application Form ${escapeHtml(year)} Academic Year ONLY</p>
      </div></div>
      <div class="contact">
        ${school.address ? `<div>${escapeHtml(school.address)}</div>` : ""}
        ${school.phone ? `<div>${escapeHtml(school.phone)}</div>` : ""}
        ${school.email ? `<div>${escapeHtml(school.email)}</div>` : ""}
        <div>${escapeHtml(printed)}</div>
      </div>
    </header>
    <p class="keep">Keep a copy of this printout for any future enquiry.</p>
    <section>
      <div class="personal">
        <div class="personal-body">
          <span class="box">Personal Information</span>
          <p class="nb">NB: The name and its arrangement on this application MUST be EXACTLY the same as on your certificate / result slip.</p>
          ${htmlFields(data.personal)}
        </div>
        ${photoBlock}
      </div>
    </section>
    <section>
      <span class="box">Guardians Information</span>
      ${htmlFields(data.guardian)}
    </section>
    <section>
      <span class="box">Programme Choices</span>
      ${
        data.programmes.length
          ? `<table><thead><tr><th>Choice</th><th>Programme</th><th>Stream</th></tr></thead><tbody>${data.programmes
              .map(
                (row) =>
                  `<tr><td>${escapeHtml(row.choice)}</td><td class="prog">${escapeHtml(row.programme)}</td><td>${escapeHtml(row.stream || "—")}</td></tr>`,
              )
              .join("")}</tbody></table>`
          : `<p class="muted">No programme choices yet.</p>`
      }
    </section>
    <section>
      ${data.educations
        .map(
          (record) =>
            `<span class="box">${escapeHtml(record.heading)}</span>${htmlFields(record.rows)}`,
        )
        .join("")}
    </section>
    <section>
      ${data.examinations
        .map(
          (sitting) =>
            `<span class="box">${escapeHtml(sitting.heading)}</span>${htmlFields(sitting.rows)}${
              sitting.results.length
                ? `<table><thead><tr><th>Subject</th><th>Grade</th></tr></thead><tbody>${sitting.results
                    .map(
                      (row) =>
                        `<tr><td>${escapeHtml(row.subject)}</td><td>${escapeHtml(row.grade)}</td></tr>`,
                    )
                    .join("")}</tbody></table>`
                : ""
            }`,
        )
        .join("")}
    </section>
    <section>
      <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#B91C1C;">${escapeHtml(
        DECLARATION_IMPORTANT_HEADING,
      )}</p>
      <p style="margin:8px 0 14px;font-size:12px;font-weight:600;line-height:1.55;color:#B91C1C;">${escapeHtml(
        DECLARATION_IMPORTANT_BODY,
      )}</p>
      <span class="box">${escapeHtml(DECLARATION_HEADING)}</span>
      <p style="margin:0 0 10px;font-size:12px;line-height:1.55;color:#334155;">${escapeHtml(
        DECLARATION_CERTIFY,
      )}</p>
      <p style="margin:0 0 10px;font-size:12px;line-height:1.55;color:#334155;">${escapeHtml(
        DECLARATION_PERMISSION_BEFORE,
      )}<strong style="font-weight:700;color:#111827;">${escapeHtml(
        declarationSchoolLabel(school.name),
      )}</strong>${escapeHtml(DECLARATION_PERMISSION_AFTER)}</p>
      <p style="margin:0 0 10px;font-size:12px;line-height:1.55;color:#334155;">${escapeHtml(
        DECLARATION_FALSEHOOD,
      )}</p>
      ${(() => {
        const signed = declarationSignedParts(
          certificateNameFromPrintout(data),
        );
        return `<p style="margin:0;font-size:12px;line-height:1.55;font-weight:700;color:#111827;">${escapeHtml(
          signed.before,
        )}${escapeHtml(signed.name)} <span style="color:#B91C1C;font-weight:700;">${escapeHtml(
          signed.hint,
        )}</span>${escapeHtml(signed.after)}</p>`;
      })()}
    </section>
  </div>
</body>
</html>`,
  };
}

export async function downloadApplicationPrintout(opts: {
  school: ApplicationPrintoutSchool;
  data: ApplicationPrintoutData;
}) {
  const { number, html } = buildPrintoutHtml(opts);
  const filename = `${number.replace(/[^\w.-]+/g, "_")}-application-summary.pdf`;
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;left:-12000px;top:0;width:794px;background:#fff;pointer-events:none;";
  document.body.appendChild(host);

  try {
    const inlined = await inlineRemoteImages(html);
    const parsed = new DOMParser().parseFromString(inlined, "text/html");
    const style = parsed.querySelector("style");
    const sheet = parsed.querySelector(".sheet") as HTMLElement | null;
    if (!sheet) {
      throw new Error("Failed to render printout");
    }
    if (style) host.appendChild(document.importNode(style, true));
    host.appendChild(document.importNode(sheet, true));
    const mountedSheet = host.querySelector(".sheet") as HTMLElement | null;
    if (!mountedSheet) {
      throw new Error("Failed to render printout");
    }
    await waitForImages(host);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    const [{ jsPDF }, html2canvasModule] = await Promise.all([
      import("jspdf"),
      import("html2canvas"),
    ]);
    const html2canvas =
      html2canvasModule.default ??
      (html2canvasModule as unknown as typeof html2canvasModule.default);
    const canvas = await html2canvas(mountedSheet, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: 794,
    });

    const image = canvas.toDataURL("image/jpeg", 0.92);
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imageWidth = pageWidth;
    const imageHeight = (canvas.height * imageWidth) / canvas.width;
    let heightLeft = imageHeight;
    let position = 0;

    pdf.addImage(image, "JPEG", 0, position, imageWidth, imageHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 1) {
      position = heightLeft - imageHeight;
      pdf.addPage();
      pdf.addImage(image, "JPEG", 0, position, imageWidth, imageHeight);
      heightLeft -= pageHeight;
    }
    pdf.save(filename);
  } catch (error) {
    console.error("[downloadApplicationPrintout]", error);
    window.alert("Could not generate the PDF. Please try again.");
  } finally {
    host.remove();
  }
}
