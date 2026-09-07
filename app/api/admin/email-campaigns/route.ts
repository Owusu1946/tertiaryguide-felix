import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";
import { buildMarketingEmail, sendCampaignEmail } from "../../../../lib/email";
import { notifyManyUsers } from "../../../../lib/user-notifications-server";
import { nonStaffUserFilter, requireSuperadmin } from "../../../../lib/admin-access";
import { absoluteUrl } from "../../../../lib/site-url";
import { isInApproachingWindow } from "../../../../lib/deadlines";

function sanitizeCampaignHtml(input: string): string {
  return input
    .replace(/<\s*(script|style|iframe|object|embed|form)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript\s*:/gi, "")
    .trim();
}

function normalizeEmails(values: unknown[]): string[] {
  return Array.from(new Set(values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))));
}

function normalizeFooter(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const keys = ["location", "phone", "phoneSecondary", "email", "instagram", "facebook", "twitter", "tiktok", "youtube"];
  return Object.fromEntries(keys.map((key) => [key, typeof raw[key] === "string" ? raw[key].trim().slice(0, 300) : ""]));
}

function schoolCard(school: Record<string, any>): string {
  const name = String(school.alias || school.name || "Institution");
  const deadline = school.deadline ? new Date(school.deadline) : null;
  const deadlineLabel = deadline && !Number.isNaN(deadline.getTime()) ? deadline.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "See admissions details";
  const logo = school.logoSrc ? absoluteUrl(String(school.logoSrc)) : absoluteUrl("/hero/full-logo.png");
  const href = school.slug ? absoluteUrl(`/apply/school/${school.slug}`) : absoluteUrl("/apply");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border:1px solid #e5e7eb;background:#fff"><tr><td style="padding:16px;width:72px;vertical-align:top"><img src="${logo}" alt="${name} logo" width="56" height="56" style="display:block;width:56px;height:56px;object-fit:contain"></td><td style="padding:16px 16px 16px 0;vertical-align:top"><p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#1f2933">${name}</p><p style="margin:0 0 10px;color:#6b7280;font-size:13px">Application deadline: ${deadlineLabel}</p><a href="${href}" style="color:#374151;font-size:13px;font-weight:600">View admissions details</a></td></tr></table>`;
}

function expandSchoolTokens(html: string, schools: Array<Record<string, any>>): string {
  return html.replace(/\{school:([^}]+)\}/gi, (_match, rawKey: string) => {
    const key = rawKey.trim().toLowerCase();
    const school = schools.find((item) => [item.slug, item.name, item.alias].some((value) => typeof value === "string" && value.toLowerCase() === key));
    return school ? schoolCard(school) : `<p style="color:#6b7280">School unavailable: ${rawKey.trim()}</p>`;
  });
}

export async function GET(req: NextRequest) {
  const auth = await requireSuperadmin(req);
  if ("response" in auth) return auth.response;
  try {
    const db = await getDb();
    const campaignsCol = db.collection("emailCampaigns");

    const campaigns = await campaignsCol
      .find({})
      .sort({ sentAt: -1 })
      .limit(100)
      .toArray();

    const sanitized = campaigns.map((c) => ({
      id: String(c._id),
      subject: c.subject || "",
      contentHtml: c.contentHtml || "",
      target: c.target || "",
      singleEmail: c.singleEmail || null,
      totalEmails: c.totalEmails || 0,
      successCount: c.successCount || 0,
      failureCount: c.failureCount || 0,
      sentAt: c.sentAt ? new Date(c.sentAt).toISOString() : "",
      status: c.status || "Unknown",
    }));

    return NextResponse.json({ ok: true, campaigns: sanitized }, { status: 200 });
  } catch (error) {
    console.error("[admin/email-campaigns] GET error", error);
    return NextResponse.json(
      { error: "Failed to fetch email campaign history" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSuperadmin(req);
  if ("response" in auth) return auth.response;
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const { subject, htmlContent, target, singleEmail, previewText, footer } = body;

    if (!subject || typeof subject !== "string" || !subject.trim()) {
      return NextResponse.json({ error: "Subject line is required" }, { status: 400 });
    }

    if (!htmlContent || typeof htmlContent !== "string" || !htmlContent.trim()) {
      return NextResponse.json({ error: "Email campaign body content is required" }, { status: 400 });
    }

    const cleanContent = sanitizeCampaignHtml(htmlContent);
    if (!cleanContent) {
      return NextResponse.json({ error: "Email campaign body content is empty" }, { status: 400 });
    }
    const cleanFooter = normalizeFooter(footer);
    let resolvedContent = cleanContent;

    if (!["all", "form-buyers", "single", "school", "approaching-deadlines"].includes(target)) {
      return NextResponse.json({ error: "Invalid target selected" }, { status: 400 });
    }

    const db = await getDb();
    let emails: string[] = [];
    const schools = await db.collection("schools").find({}, { projection: { name: 1, alias: 1, slug: 1, logoSrc: 1, deadline: 1 } }).limit(500).toArray();

    if (target === "school") {
      const schoolKey = typeof body.schoolKey === "string" ? body.schoolKey.trim().toLowerCase() : "";
      const school = schools.find((item) => [item.slug, item.name, item.alias].some((value) => typeof value === "string" && value.toLowerCase() === schoolKey));
      if (!school) return NextResponse.json({ error: "Choose a valid school" }, { status: 400 });
      resolvedContent = expandSchoolTokens(cleanContent.replace(/\{school:[^}]+\}/gi, `{school:${school.slug || school.name}}`), schools);
    } else if (target === "approaching-deadlines") {
      const days = Math.min(90, Math.max(1, Number(body.deadlineDays) || 30));
      const approaching = schools.filter((school) => isInApproachingWindow(school.deadline ? new Date(school.deadline).toISOString() : null, days));
      if (!approaching.length) return NextResponse.json({ error: `No school deadlines found in the next ${days} days` }, { status: 400 });
      resolvedContent = expandSchoolTokens(cleanContent, schools).replace(/\{approaching-deadlines\}/gi, approaching.map((school) => schoolCard(school)).join(""));
    } else {
      resolvedContent = expandSchoolTokens(cleanContent, schools);
    }
    const finalHtml = buildMarketingEmail({ contentHtml: resolvedContent, previewText: typeof previewText === "string" ? previewText : subject, footer: cleanFooter });

    if (target === "single") {
      if (!singleEmail || typeof singleEmail !== "string" || !singleEmail.trim()) {
        return NextResponse.json({ error: "Recipient email is required for single target" }, { status: 400 });
      }
      emails = normalizeEmails([singleEmail]);
    } else if (target === "all" || target === "school" || target === "approaching-deadlines") {
      const usersCol = db.collection("users");
      const users = await usersCol.find(nonStaffUserFilter(), { projection: { email: 1 } }).toArray();
      emails = normalizeEmails(users.map((u) => u.email));
    } else if (target === "form-buyers") {
      const voucherPaymentsCol = db.collection("voucherPayments");
      const payments = await voucherPaymentsCol.find({}, { projection: { email: 1 } }).toArray();
      emails = normalizeEmails(payments.map((p) => p.email));
    }

    if (emails.length === 0) {
      return NextResponse.json(
        { error: "No recipient emails found matching the criteria" },
        { status: 400 },
      );
    }

    let successCount = 0;
    let failureCount = 0;
    const failedEmails: string[] = [];

    const chunkSize = 5;
    for (let i = 0; i < emails.length; i += chunkSize) {
      const chunk = emails.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (email) => {
          try {
            const result = await sendCampaignEmail({
              to: email,
              subject,
              html: finalHtml,
            });

            if (result && result.error) {
              console.error(`Resend error sending campaign to ${email}:`, result.error);
              failureCount++;
              failedEmails.push(email);
            } else {
              successCount++;
            }
          } catch (err) {
            console.error(`Nodemailer/Resend exception for ${email}:`, err);
            failureCount++;
            failedEmails.push(email);
          }
        })
      );

      if (i + chunkSize < emails.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    const status = failureCount === 0 ? "Success" : successCount > 0 ? "Partial Success" : "Failed";

    const campaignDoc = {
      subject,
      contentHtml: resolvedContent,
      previewText: typeof previewText === "string" ? previewText.trim() : "",
      footer: cleanFooter,
      createdBy: auth.user.username,
      target,
      singleEmail: target === "single" ? singleEmail : null,
      totalEmails: emails.length,
      successCount,
      failureCount,
      failedEmails,
      sentAt: new Date(),
      status,
    };

    const campaignsCol = db.collection("emailCampaigns");
    const insertResult = await campaignsCol.insertOne(campaignDoc);

    if (successCount > 0) {
      const delivered = emails.filter((email) => !failedEmails.includes(email));
      void notifyManyUsers(db, delivered, {
        title: "New email from TertiaryGuide",
        body: subject.trim(),
        kind: "email",
        href: "/dashboard/notification",
        dedupeKey: `email-campaign:${String(insertResult.insertedId)}`,
      }).catch((err) =>
        console.error("[admin/email-campaigns] notify users", err),
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: `Campaign sent. Success: ${successCount}, Failures: ${failureCount}`,
        stats: {
          total: emails.length,
          successCount,
          failureCount,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[admin/email-campaigns] POST error", error);
    return NextResponse.json(
      { error: "Internal server error during email dispatch" },
      { status: 500 },
    );
  }
}
