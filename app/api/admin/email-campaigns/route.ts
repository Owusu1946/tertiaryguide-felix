import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";
import { buildMarketingEmail, sendCampaignEmail } from "../../../../lib/email";
import { notifyManyUsers } from "../../../../lib/user-notifications-server";
import { nonStaffUserFilter, requireSuperadmin } from "../../../../lib/admin-access";

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

    const { subject, htmlContent, target, singleEmail, previewText } = body;

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
    const finalHtml = buildMarketingEmail({
      contentHtml: cleanContent,
      previewText: typeof previewText === "string" ? previewText : subject,
    });

    if (!["all", "form-buyers", "single"].includes(target)) {
      return NextResponse.json({ error: "Invalid target selected" }, { status: 400 });
    }

    const db = await getDb();
    let emails: string[] = [];

    if (target === "single") {
      if (!singleEmail || typeof singleEmail !== "string" || !singleEmail.trim()) {
        return NextResponse.json({ error: "Recipient email is required for single target" }, { status: 400 });
      }
      emails = normalizeEmails([singleEmail]);
    } else if (target === "all") {
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
      contentHtml: cleanContent,
      previewText: typeof previewText === "string" ? previewText.trim() : "",
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
