import { Resend } from "resend";
import { absoluteUrl } from "./site-url";
import { studentStatusCopy } from "./admissions/status-messages";

const apiKey = process.env.RESEND_API_KEY;
const fromEmailEnv = process.env.EMAIL_FROM;

if (!apiKey || !fromEmailEnv) {
  // We throw here so it's obvious in development if env is missing.
  throw new Error("RESEND_API_KEY and EMAIL_FROM must be set in environment variables");
}

const resend = new Resend(apiKey);
const FROM_EMAIL: string = fromEmailEnv as string;

export async function sendOtpEmail(opts: {
  to: string;
  code: string;
  /** Default: email verification during signup. */
  purpose?:
    | "verification"
    | "password_reset"
    | "admin_password_reset"
    | "admin_email_recovery";
}): Promise<void> {
  const { to, code, purpose = "verification" } = opts;
  const isReset = purpose === "password_reset";
  const isAdminReset = purpose === "admin_password_reset";
  const isAdminEmailRecovery = purpose === "admin_email_recovery";

  const subject = isAdminReset
    ? "Reset your TertiaryGuide admin password"
    : isAdminEmailRecovery
      ? "Verify your TertiaryGuide admin account"
      : isReset
        ? "Reset your TertiaryGuide password"
        : "Your TertiaryGuide verification code";

  const intro = isAdminReset
    ? "Use the code below to reset your TertiaryGuide admin account password. If you didn’t request this, you can ignore this email."
    : isAdminEmailRecovery
      ? "Use the code below to recover or update the email on your TertiaryGuide admin account."
      : isReset
        ? "Use the code below to reset your TertiaryGuide account password. If you didn’t request a reset, you can ignore this email."
        : "Use the code below to verify your email and continue your admission journey:";

  console.log("[sendOtpEmail] Attempting to send OTP", {
    to,
    from: FROM_EMAIL,
    hasApiKey: Boolean(apiKey),
    purpose,
  });

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    text: isReset || isAdminReset || isAdminEmailRecovery
      ? [
          "Hello from TertiaryGuide,",
          "",
          intro,
          "",
          `OTP: ${code}`,
          "",
          "This code expires in 10 minutes. If you didn’t request this, you can safely ignore this email.",
          "",
          "The TertiaryGuide Team",
        ].join("\n")
      : [
          "Hello from TertiaryGuide,",
          "",
          intro,
          "",
          `OTP: ${code}`,
          "",
          "This code expires in 10 minutes. If you didn’t request this, you can safely ignore this email.",
          "",
          "Best of luck with your applications,",
          "The TertiaryGuide Team",
        ].join("\n"),
    html: `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; padding: 24px;">
        <p style="margin: 0 0 12px 0; font-size: 16px;">Hello from <strong>TertiaryGuide</strong>,</p>
        <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5;">
          ${isAdminReset
      ? "Use the code below to <strong>reset your admin password</strong>. If you didn’t request this, you can safely ignore this email."
      : isAdminEmailRecovery
        ? "Use the code below to <strong>recover or update your admin email</strong>."
        : isReset
          ? "Use the code below to <strong>reset your password</strong>. If you didn’t request this, you can safely ignore this email."
          : "Use the code below to verify your email and continue your admission journey."}
        </p>
        <div
          style="
            margin: 0 0 16px 0;
            display: inline-block;
            padding: 12px 20px;
            border-radius: 9999px;
            background-color: #007AFF0D;
            border: 1px dashed #007AFF;
            color: #111827;
            font-weight: 600;
            letter-spacing: 0.2em;
            font-size: 18px;
            -webkit-user-select: all;
            -moz-user-select: all;
            -ms-user-select: all;
            user-select: all;
          "
        >
          ${code}
        </div>
        <p style="margin: 0 0 8px 0; font-size: 12px; color: #6B7280;">
          Tip: tap or drag to select the code above, then copy it into the TertiaryGuide window.
        </p>
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #374151;">
          This code expires in <strong>10 minutes</strong>. If you didn’t request this, you can safely ignore this email.
        </p>
        <p style="margin: 16px 0 0 0; font-size: 13px; color: #374151;">
          ${
            isReset
              ? "<strong>The TertiaryGuide Team</strong>"
              : "Best of luck with your applications,<br /><strong>The TertiaryGuide Team</strong>"
          }
        </p>
      </div>
    `,
  });

  console.log("[sendOtpEmail] Resend response", result);

  if (result.error) {
    throw new Error(
      result.error.message || "Failed to send verification email",
    );
  }
}

export async function sendWelcomeEmail(opts: {
  to: string;
  username?: string;
}): Promise<void> {
  const { to, username } = opts;
  const siteUrl = absoluteUrl("/");
  const logoUrl = absoluteUrl("/hero/logoTguide.png");
  const exploreUrl = absoluteUrl("/explore");
  const formsUrl = absoluteUrl("/university-forms");
  const wassceUrl = absoluteUrl("/wassce-checker");
  const programmesUrl = absoluteUrl("/program-search");
  const deadlinesUrl = absoluteUrl("/#deadlines");
  const myFormsUrl = absoluteUrl("/dashboard/my-forms");
  const assistanceUrl = absoluteUrl("/dashboard/assistance");
  const blogUrl = absoluteUrl("/blog");
  const faqsUrl = absoluteUrl("/faqs");
  const greetingName = (username || "").trim();
  const greeting = greetingName ? `Hello ${greetingName},` : "Hello,";

  const features: { title: string; body: string; href: string; extra?: string }[] =
    [
      {
        title: "Buy University Application Forms",
        body: "Purchase admission forms for top universities — including teacher training and nursing training — directly through the platform. No queues, no stress.",
        href: formsUrl,
      },
      {
        title: "WASSCE Checker Vouchers",
        body: "Get your WASSCE checker PIN instantly after payment — no more back-and-forth on WhatsApp groups.",
        href: wassceUrl,
      },
      {
        title: "Find & Compare Programmes",
        body: "Compare programmes across institutions side by side — save days of hunting through PDFs and school websites.",
        href: programmesUrl,
      },
      {
        title: "Never Miss a Deadline",
        body: "See approaching deadlines across every school in one place, so important dates never slip through the cracks.",
        href: deadlinesUrl,
      },
      {
        title: 'Track Everything in "My Forms"',
        body: "Your personalized dashboard keeps every form and voucher you've purchased in one organized place.",
        href: myFormsUrl,
      },
      {
        title: "Get Real Assistance",
        body: "Have an issue with a purchase? Need a guide? Our support team responds with a reference number and gets you sorted quickly.",
        href: assistanceUrl,
      },
      {
        title: "Guides Written For You",
        body: "Our blog and FAQ cover everything from financial aid to thriving in your first semester — especially helpful if you're a first-generation applicant navigating this alone.",
        href: blogUrl,
        extra: `<a href="${escapeHtml(faqsUrl)}" style="color:#007AFF;text-decoration:underline;">Read FAQs</a>`,
      },
    ];

  const subject = "Welcome to TertiaryGuide — your account is ready";
  const text = [
    greeting,
    "",
    "Welcome to TertiaryGuide",
    "Your account is ready. You're now one step closer to a stress-free journey through university admissions, programme search, and WASSCE results.",
    "",
    `Explore More: ${exploreUrl}`,
    "",
    "Here's everything you can do on the platform",
    "Built to make tertiary admissions in Ghana simpler, faster, and stress-free.",
    "",
    ...features.flatMap((feature) => [
      feature.title,
      feature.body,
      feature.href,
      "",
    ]),
    `Explore More: ${exploreUrl}`,
    "",
    "The TertiaryGuide Team",
    siteUrl,
  ].join("\n");

  const featureRows = features
    .map(
      (feature) => `
          <tr>
            <td style="padding:0 0 12px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8FAFC;border:1px solid #E8EEF5;border-radius:14px;">
                <tr>
                  <td style="padding:16px 18px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                    <p style="margin:0 0 6px 0;font-size:15px;font-weight:700;line-height:1.35;">
                      <a href="${escapeHtml(feature.href)}" style="color:#0F172A;text-decoration:none;">
                        ${escapeHtml(feature.title)}
                      </a>
                    </p>
                    <p style="margin:0 0 10px 0;font-size:13px;line-height:1.6;color:#475569;">
                      ${escapeHtml(feature.body)}
                    </p>
                    <p style="margin:0;font-size:13px;font-weight:600;">
                      <a href="${escapeHtml(feature.href)}" style="color:#007AFF;text-decoration:none;">
                        Open this on TertiaryGuide →
                      </a>
                      ${feature.extra ? `&nbsp;·&nbsp; ${feature.extra}` : ""}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`,
    )
    .join("");

  const exploreButton = `
              <a
                href="${escapeHtml(exploreUrl)}"
                style="
                  display:inline-block;
                  padding:14px 28px;
                  border-radius:9999px;
                  background-color:#007AFF;
                  color:#ffffff !important;
                  font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                  font-size:15px;
                  font-weight:700;
                  text-decoration:none;
                  box-shadow:0 8px 20px rgba(0,122,255,0.25);
                "
              >Explore More →</a>`;

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    text,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4F6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #E5E7EB;">
          <tr>
            <td style="padding:28px 32px 20px 32px;background:linear-gradient(180deg,#F0F7FF 0%,#FFFFFF 100%);border-bottom:1px solid #E8EEF5;">
              <a href="${escapeHtml(siteUrl)}" style="text-decoration:none;">
                <img
                  src="${escapeHtml(logoUrl)}"
                  alt="TertiaryGuide"
                  width="168"
                  height="40"
                  style="display:block;height:40px;width:auto;max-width:180px;border:0;"
                />
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px 32px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0F172A;">
              <p style="margin:0 0 8px 0;font-size:14px;color:#475569;">${escapeHtml(greeting)}</p>
              <h1 style="margin:0 0 12px 0;font-size:26px;line-height:1.25;font-weight:700;color:#0F172A;">
                Welcome to TertiaryGuide
              </h1>
              <p style="margin:0;font-size:15px;line-height:1.65;color:#475569;">
                Your account is ready. You're now one step closer to a stress-free journey through university admissions, programme search, and WASSCE results.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 32px 8px 32px;">
              ${exploreButton}
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px 32px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
              <p style="margin:0 0 6px 0;font-size:13px;font-weight:700;color:#0F172A;text-transform:uppercase;letter-spacing:0.04em;">
                Here's everything you can do on the platform
              </p>
              <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#475569;">
                Built to make tertiary admissions in Ghana simpler, faster, and stress-free.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${featureRows}
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:12px 32px 28px 32px;">
              ${exploreButton}
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px;background-color:#0B1220;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
              <p style="margin:0 0 6px 0;font-size:14px;font-weight:600;color:#FFFFFF;">
                The TertiaryGuide Team
              </p>
              <a href="${escapeHtml(siteUrl)}" style="font-size:12px;color:#60A5FA;text-decoration:none;">
                tertiaryguide.com
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  });

  console.log("[sendWelcomeEmail] Resend response", {
    to,
    error: result.error ?? null,
    id: result.data?.id ?? null,
  });

  if (result.error) {
    throw new Error(result.error.message || "Failed to send welcome email");
  }
}

export async function sendWassceCheckerEmail(opts: {
  to: string;
  fullName?: string;
  checkers: { serial: string; pin: string }[];
}): Promise<void> {
  const { to, fullName, checkers } = opts;

  const safeCheckers = Array.isArray(checkers) && checkers.length > 0
    ? checkers
    : [];

  const subject = safeCheckers.length > 1
    ? `Your ${safeCheckers.length} WASSCE Results Checkers (TertiaryGuide)`
    : "Your WASSCE Results Checker (TertiaryGuide)";

  const textLines = [
    `Hello${fullName ? ` ${fullName}` : ""},`,
    "",
    safeCheckers.length > 1
      ? "Here are your WASSCE results checkers from TertiaryGuide."
      : "Here is your WASSCE results checker from TertiaryGuide.",
    "",
    ...safeCheckers.map(
      (c, index) =>
        [
          safeCheckers.length > 1 ? `Checker ${index + 1}:` : "Checker:",
          `Serial: ${c.serial}`,
          `PIN: ${c.pin}`,
          "",
        ].join("\n"),
    ),
    "Keep these details safe and do not share them publicly.",
    "",
    "Thank you for using TertiaryGuide.",
  ];

  const itemsHtml = safeCheckers
    .map(
      (c, index) => `
        <div style="margin: 0 0 12px 0; padding: 12px 14px; border-radius: 12px; background: linear-gradient(135deg, #007AFF0D, #EEF2FF); border: 1px solid #E5E7EB;">
          <p style="margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6B7280;">
            Checker ${index + 1}
          </p>
          <p style="margin: 0 0 4px 0; font-size: 14px;">
            <span style="font-weight: 600; color: #111827;">Serial:</span>
            <span style="margin-left: 8px; font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${c.serial}</span>
          </p>
          <p style="margin: 4px 0 0 0; font-size: 14px;">
            <span style="font-weight: 600; color: #111827;">PIN:</span>
            <span style="margin-left: 8px; font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${c.pin}</span>
          </p>
        </div>
      `,
    )
    .join("\n");

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    text: textLines.join("\n"),
    html: `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; padding: 24px; background-color: #F9FAFB;">
        <div style="max-width: 520px; margin: 0 auto; background-color: #FFFFFF; border-radius: 16px; padding: 24px; box-shadow: 0 10px 30px rgba(15,23,42,0.12);">
          <p style="margin: 0 0 12px 0; font-size: 16px;">Hello${fullName ? ` <strong>${fullName}</strong>` : ""
      },</p>
          <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #4B5563;">
            ${safeCheckers.length > 1
        ? "Here are your <strong>WASSCE results checkers</strong> purchased via TertiaryGuide."
        : "Here is your <strong>WASSCE results checker</strong> purchased via TertiaryGuide."
      }
          </p>

          ${itemsHtml}

          <p style="margin: 0 0 8px 0; font-size: 13px; color: #374151;">
            Keep this email safe. Anyone with access to these serials and PINs can use the checkers.
          </p>
          <p style="margin: 0 0 16px 0; font-size: 13px; color: #6B7280;">
            If you did not initiate this purchase, please contact our support team.
          </p>

          <p style="margin: 0; font-size: 12px; color: #9CA3AF;">
            Sent securely by <strong>TertiaryGuide</strong>.
          </p>
        </div>
      </div>
    `,
  });

  console.log("[sendWassceCheckerEmail] Resend response", result);
}

export async function sendFormVoucherEmail(opts: {
  to: string;
  fullName?: string;
  schoolId: string;
  schoolName: string;
  voucher: { serial: string; pin: string };
}): Promise<void> {
  const { to, fullName, schoolName, voucher } = opts;
  const myFormsUrl = absoluteUrl("/dashboard/my-forms");

  const subject = `Your ${schoolName} Voucher (TertiaryGuide)`;

  const textLines = [
    `Hello${fullName ? ` ${fullName}` : ""},`,
    "",
    `Here is your ${schoolName} voucher from TertiaryGuide.`,
    "",
    `School: ${schoolName}`,
    `Serial: ${voucher.serial}`,
    `PIN: ${voucher.pin}`,
    "",
    "Keep these details safe and do not share them publicly.",
    "",
    `View this voucher anytime in My Forms: ${myFormsUrl}`,
    "",
    "Thank you for using TertiaryGuide.",
  ];

  const html = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; padding: 24px; background-color: #F9FAFB;">
        <div style="max-width: 520px; margin: 0 auto; background-color: #FFFFFF; border-radius: 16px; padding: 24px; box-shadow: 0 10px 30px rgba(15,23,42,0.12);">
          <p style="margin: 0 0 12px 0; font-size: 16px;">Hello${fullName ? ` <strong>${fullName}</strong>` : ""
    },</p>
          <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #4B5563;">
            Here is your <strong>${escapeHtml(schoolName)} voucher</strong> purchased via TertiaryGuide.
          </p>

          <div style="margin: 0 0 12px 0; padding: 12px 14px; border-radius: 12px; background: linear-gradient(135deg, #007AFF0D, #EEF2FF); border: 1px solid #E5E7EB;">
            <p style="margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6B7280;">
              Voucher Details
            </p>
            <p style="margin: 4px 0; font-size: 14px;">
              <span style="font-weight: 600; color: #111827;">School:</span>
              <span style="margin-left: 8px; font-weight: 500;">${escapeHtml(schoolName)}</span>
            </p>
            <p style="margin: 4px 0; font-size: 14px;">
              <span style="font-weight: 600; color: #111827;">Serial:</span>
              <span style="margin-left: 8px; font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${escapeHtml(voucher.serial)}</span>
            </p>
            <p style="margin: 4px 0 0 0; font-size: 14px;">
              <span style="font-weight: 600; color: #111827;">PIN:</span>
              <span style="margin-left: 8px; font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${escapeHtml(voucher.pin)}</span>
            </p>
          </div>

          <p style="margin: 0 0 16px 0; text-align: center;">
            <a href="${escapeHtml(myFormsUrl)}" style="display:inline-block;padding:12px 22px;border-radius:9999px;background-color:#007AFF;color:#ffffff !important;font-size:14px;font-weight:700;text-decoration:none;">
              Open My Forms
            </a>
          </p>

          <p style="margin: 0 0 8px 0; font-size: 13px; color: #374151;">
            Keep this email safe. Anyone with access to this serial and PIN can use the voucher.
          </p>
          <p style="margin: 0 0 16px 0; font-size: 13px; color: #6B7280;">
            If you did not initiate this purchase, please contact our support team.
          </p>

          <p style="margin: 0; font-size: 12px; color: #9CA3AF;">
            Sent securely by <strong>TertiaryGuide</strong>.
          </p>
        </div>
      </div>
    `;

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    text: textLines.join("\n"),
    html,
  });

  console.log("[sendFormVoucherEmail] Resend response", result);
}

const ADMIN_INBOX = () =>
  process.env.ADMIN_INBOX_EMAIL?.trim() || "info@tertiaryguide.com";

export async function sendInstitutionRequestToAdmin(opts: {
  requesterName: string;
  requesterEmail: string | null;
  requesterPhone: string | null;
  institutionName: string;
  message: string | null;
}): Promise<void> {
  const {
    requesterName,
    requesterEmail,
    requesterPhone,
    institutionName,
    message,
  } = opts;
  const to = ADMIN_INBOX();
  const subject = `Institution form request: ${institutionName}`;

  const bodyLines = [
    "Someone asked to add an institution to University Forms on TertiaryGuide.",
    "",
    `Requester: ${requesterName}`,
    requesterEmail ? `Email: ${requesterEmail}` : "Email: (not provided)",
    requesterPhone ? `Phone: ${requesterPhone}` : "Phone: (not provided)",
    "",
    `Institution requested: ${institutionName}`,
  ];
  if (message) {
    bodyLines.push("", "Additional details:", message);
  }

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    text: bodyLines.join("\n"),
    html: `
      <div style="font-family: system-ui, sans-serif; color: #111827; padding: 20px; line-height: 1.5;">
        <h2 style="margin: 0 0 12px; font-size: 18px;">Institution form request</h2>
        <p style="margin: 0 0 16px; color: #4B5563;">A user could not find a school and submitted this from the University Forms page.</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 480px;">
          <tr><td style="padding: 6px 0; color: #6B7280; width: 120px;">Name</td><td style="padding: 6px 0;">${escapeHtml(
            requesterName,
          )}</td></tr>
          <tr><td style="padding: 6px 0; color: #6B7280;">Email</td><td style="padding: 6px 0;">${
            requesterEmail
              ? escapeHtml(requesterEmail)
              : "<em>Not provided</em>"
          }</td></tr>
          <tr><td style="padding: 6px 0; color: #6B7280;">Phone</td><td style="padding: 6px 0;">${
            requesterPhone
              ? escapeHtml(requesterPhone)
              : "<em>Not provided</em>"
          }</td></tr>
          <tr><td style="padding: 6px 0; color: #6B7280; vertical-align: top;">Institution</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(
            institutionName,
          )}</td></tr>
        </table>
        ${
          message
            ? `<p style="margin: 16px 0 0; color: #374151;"><strong>Details</strong><br/>${escapeHtml(
                message,
              ).replace(/\n/g, "<br/>")}</p>`
            : ""
        }
      </div>
    `,
  });

  console.log("[sendInstitutionRequestToAdmin] Resend response", result);
}

export async function sendFormPendingVoucherToAdmin(opts: {
  schoolName: string;
  schoolId: string;
  buyerEmail: string;
  fullName: string | null;
  paystackReference: string;
  amountMinor: number;
  currency: string;
  paidAt: Date;
}): Promise<void> {
  const {
    schoolName,
    schoolId,
    buyerEmail,
    fullName,
    paystackReference,
    amountMinor,
    currency,
    paidAt,
  } = opts;
  const to = ADMIN_INBOX();
  const subject = `No voucher in stock: ${schoolName} — action needed`;
  const amountDisplay = `${currency} ${(amountMinor / 100).toFixed(2)}`;
  const lines = [
    "A customer paid for a university form, but there were no unserved voucher codes in stock for this school.",
    "",
    `School: ${schoolName}`,
    `School ID: ${schoolId}`,
    `Buyer email: ${buyerEmail}`,
    fullName ? `Buyer name: ${fullName}` : "Buyer name: (not provided)",
    `Amount: ${amountDisplay}`,
    `Paystack reference: ${paystackReference}`,
    `Paid at: ${paidAt.toISOString()}`,
    "",
    "Issue: Add more vouchers in admin for this school, then link this payment to a serial/PIN (or your existing process).",
  ];

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    text: lines.join("\n"),
    html: `
      <div style="font-family: system-ui, sans-serif; color: #111827; padding: 20px; line-height: 1.5;">
        <h2 style="margin: 0 0 12px; font-size: 18px;">Payment received — no voucher in stock</h2>
        <p style="margin: 0 0 16px; color: #4B5563;">A customer paid for a form, but there were no <strong>unserved</strong> voucher codes for this school. Please upload vouchers and fulfill this order.</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 520px;">
          <tr><td style="padding: 6px 0; color: #6B7280; width: 130px;">School</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(
            schoolName,
          )}</td></tr>
          <tr><td style="padding: 6px 0; color: #6B7280;">School ID</td><td style="padding: 6px 0; font-family: monospace; font-size: 13px;">${escapeHtml(
            schoolId,
          )}</td></tr>
          <tr><td style="padding: 6px 0; color: #6B7280;">Buyer</td><td style="padding: 6px 0;">${escapeHtml(
            buyerEmail,
          )}${
    fullName
      ? ` &middot; ${escapeHtml(fullName)}`
      : ""
  }</td></tr>
          <tr><td style="padding: 6px 0; color: #6B7280;">Amount</td><td style="padding: 6px 0;">${escapeHtml(
            amountDisplay,
          )}</td></tr>
          <tr><td style="padding: 6px 0; color: #6B7280;">Paystack ref</td><td style="padding: 6px 0; font-family: monospace;">${escapeHtml(
            paystackReference,
          )}</td></tr>
        </table>
        <p style="margin: 16px 0 0; font-size: 13px; color: #6B7280;">Paid: ${escapeHtml(
          paidAt.toISOString(),
        )}</p>
      </div>
    `,
  });

  console.log("[sendFormPendingVoucherToAdmin] Resend response", result);
}

export async function sendWassceCheckerPendingToAdmin(opts: {
  buyerEmail: string;
  fullName: string | null;
  paystackReference: string;
  amountMinor: number;
  currency: string;
  paidAt: Date;
  quantity: number;
  issuedCount: number;
}): Promise<void> {
  const {
    buyerEmail,
    fullName,
    paystackReference,
    amountMinor,
    currency,
    paidAt,
    quantity,
    issuedCount,
  } = opts;
  const to = ADMIN_INBOX();
  const shortfall = Math.max(0, quantity - issuedCount);
  const subject = `WASSCE checkers: paid, ${shortfall} not yet issued — action needed`;
  const amountDisplay = `${currency} ${(amountMinor / 100).toFixed(2)}`;
  const lines = [
    "A customer paid for WASSCE checker(s), but not enough unissued checkers were available to fulfill the order at payment time.",
    "",
    `Quantity paid for: ${quantity}`,
    `Issued so far: ${issuedCount} (${shortfall} still needed)`,
    `Buyer email: ${buyerEmail}`,
    fullName ? `Buyer name: ${fullName}` : "Buyer name: (not provided)",
    `Amount: ${amountDisplay}`,
    `Paystack reference: ${paystackReference}`,
    `Paid at: ${paidAt.toISOString()}`,
    "",
    "Add more unissued checkers in admin, then the customer can refresh the success page (or your pending job) to complete the order.",
  ];

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    text: lines.join("\n"),
    html: `
      <div style="font-family: system-ui, sans-serif; color: #111827; padding: 20px; line-height: 1.5;">
        <h2 style="margin: 0 0 12px; font-size: 18px;">Payment received — checkers not fully issued</h2>
        <p style="margin: 0 0 16px; color: #4B5563;">The customer paid for <strong>${escapeHtml(
          String(quantity),
        )}</strong> checker(s), but only <strong>${escapeHtml(
          String(issuedCount),
        )}</strong> could be assigned from stock. <strong>${escapeHtml(
          String(shortfall),
        )}</strong> still need to be issued when you add more checkers.</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 520px;">
          <tr><td style="padding: 6px 0; color: #6B7280; width: 130px;">Buyer</td><td style="padding: 6px 0;">${escapeHtml(
            buyerEmail,
          )}${
    fullName
      ? ` &middot; ${escapeHtml(fullName)}`
      : ""
  }</td></tr>
          <tr><td style="padding: 6px 0; color: #6B7280;">Qty / issued</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(
            `${quantity} paid, ${issuedCount} issued (need ${shortfall} more)`,
          )}</td></tr>
          <tr><td style="padding: 6px 0; color: #6B7280;">Amount</td><td style="padding: 6px 0;">${escapeHtml(
            amountDisplay,
          )}</td></tr>
          <tr><td style="padding: 6px 0; color: #6B7280;">Paystack ref</td><td style="padding: 6px 0; font-family: monospace;">${escapeHtml(
            paystackReference,
          )}</td></tr>
        </table>
        <p style="margin: 16px 0 0; font-size: 13px; color: #6B7280;">Paid: ${escapeHtml(
          paidAt.toISOString(),
        )}</p>
      </div>
    `,
  });

  console.log("[sendWassceCheckerPendingToAdmin] Resend response", result);
}

export async function sendPartnerVoucherEmail(opts: {
  to: string;
  fullName?: string;
  schoolName: string;
  voucherCode: string;
  serialNumber: string;
  applyUrl: string;
  portalUrl?: string;
}): Promise<void> {
  const { to, fullName, schoolName, voucherCode, serialNumber, applyUrl, portalUrl } =
    opts;

  // Student-facing labels match Ghana voucher format: Serial + PIN
  const serial = serialNumber;
  const pin = voucherCode;

  if (!to || !to.includes("@")) {
    throw new Error("A valid student email is required to send the voucher");
  }

  const portal =
    portalUrl ||
    `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/apply/portal`;

  console.log("[sendPartnerVoucherEmail] Sending voucher to student", {
    to,
    schoolName,
    serial,
    pin,
  });

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Your ${schoolName} admission voucher (TertiaryGuide)`,
    text: [
      `Hello${fullName ? ` ${fullName}` : ""},`,
      "",
      `Payment confirmed. Your admission voucher for ${schoolName} is ready.`,
      "",
      `Serial Number: ${serial}`,
      `PIN: ${pin}`,
      "",
      `Continue your application: ${applyUrl}`,
      `Check status / edit later: ${portal}`,
      "",
      "Keep these details safe. You will need both the Serial Number and PIN to log in.",
      "You can log in and out with the same voucher anytime.",
      "",
      "The TertiaryGuide Team",
    ].join("\n"),
    html: `
      <div style="font-family: system-ui, sans-serif; color: #111827; padding: 24px; background:#F9FAFB;">
        <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:24px;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
          <p style="margin:0 0 12px;font-size:16px;">Hello${fullName ? ` <strong>${escapeHtml(fullName)}</strong>` : ""},</p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#4B5563;">
            Payment confirmed. Your admission voucher for <strong>${escapeHtml(schoolName)}</strong> is ready.
          </p>
          <div style="margin:0 0 16px;padding:14px;border-radius:12px;background:linear-gradient(135deg,#007AFF0D,#EEF2FF);border:1px solid #E5E7EB;">
            <p style="margin:0 0 10px;font-size:14px;">
              <span style="font-weight:600;color:#111827;">Serial Number:</span>
              <span style="margin-left:8px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;letter-spacing:0.04em;">${escapeHtml(serial)}</span>
            </p>
            <p style="margin:0;font-size:14px;">
              <span style="font-weight:600;color:#111827;">PIN:</span>
              <span style="margin-left:8px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;letter-spacing:0.04em;">${escapeHtml(pin)}</span>
            </p>
          </div>
          <p style="margin:0 0 10px;">
            <a href="${escapeHtml(applyUrl)}" style="display:inline-block;background:#007AFF;color:#fff;text-decoration:none;padding:10px 16px;border-radius:9999px;font-size:14px;font-weight:600;">
              Continue application
            </a>
          </p>
          <p style="margin:0 0 8px;font-size:13px;color:#374151;">
            Keep this email safe. Anyone with both the Serial Number and PIN can use this voucher.
          </p>
          <p style="margin:0 0 16px;font-size:13px;color:#6B7280;">
            Later you can check status or edit your form at
            <a href="${escapeHtml(portal)}" style="color:#007AFF;">your application portal</a>
            using these same details.
          </p>
          <p style="margin:0;font-size:12px;color:#9CA3AF;">Sent securely by <strong>TertiaryGuide</strong>.</p>
        </div>
      </div>
    `,
  });

  console.log("[sendPartnerVoucherEmail] Resend response", {
    to,
    error: result.error ?? null,
    id: result.data?.id ?? null,
  });

  if (result.error) {
    throw new Error(result.error.message || "Failed to send voucher email");
  }
}

export async function sendApplicationSubmittedToApplicant(opts: {
  to: string;
  applicantName: string;
  schoolName: string;
  applicationNumber: string;
  submittedAt: Date;
}): Promise<void> {
  const { to, applicantName, schoolName, applicationNumber, submittedAt } = opts;
  const dateStr = submittedAt.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Application received — ${schoolName}`,
    text: [
      `Hello ${applicantName},`,
      "",
      `We have received your application to ${schoolName}.`,
      "",
      `Application Number: ${applicationNumber}`,
      `School: ${schoolName}`,
      `Submission Date: ${dateStr}`,
      "",
      "You will be notified when your application status changes.",
      "",
      "The TertiaryGuide Team",
    ].join("\n"),
    html: `
      <div style="font-family: system-ui, sans-serif; color: #111827; padding: 24px;">
        <p>Hello <strong>${escapeHtml(applicantName)}</strong>,</p>
        <p>We have received your application to <strong>${escapeHtml(schoolName)}</strong>.</p>
        <ul>
          <li><strong>Application Number:</strong> ${escapeHtml(applicationNumber)}</li>
          <li><strong>School:</strong> ${escapeHtml(schoolName)}</li>
          <li><strong>Submission Date:</strong> ${escapeHtml(dateStr)}</li>
        </ul>
        <p style="color:#6B7280;font-size:13px;">You will be notified when your application status changes.</p>
      </div>
    `,
  });

  if (result.error) {
    throw new Error(result.error.message || "Failed to send applicant confirmation");
  }
}

export async function sendApplicationSubmittedToSchool(opts: {
  to: string;
  applicantName: string;
  programme?: string | null;
  schoolName: string;
  applicationNumber: string;
  applicationUrl: string;
  updated?: boolean;
  pdf?: { filename: string; content: Buffer };
}): Promise<void> {
  const {
    to,
    applicantName,
    programme,
    schoolName,
    applicationNumber,
    applicationUrl,
    updated = false,
    pdf,
  } = opts;

  const heading = updated
    ? `An application was updated for ${schoolName}. Please open your dashboard to review the latest details.`
    : `You have received a new applicant at ${schoolName}. Please open your dashboard now to review this student.`;
  const subject = updated
    ? `Updated applicant — review ${applicantName} on your ${schoolName} dashboard`
    : `New applicant — review ${applicantName} on your ${schoolName} dashboard`;
  const pdfNote = pdf
    ? "The official application summary PDF is attached. Download it to review the full printout, then open your dashboard to change the student’s status."
    : "Open your dashboard to review this student.";

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    text: [
      "Hello,",
      "",
      heading,
      "",
      `Applicant: ${applicantName}`,
      `Programme: ${programme || "Not specified"}`,
      `Application Number: ${applicationNumber}`,
      "",
      pdfNote,
      `Review on dashboard: ${applicationUrl}`,
      "",
      "TertiaryGuide Admissions",
    ]
      .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
      .join("\n"),
    html: `
      <div style="font-family: system-ui, sans-serif; color: #111827; padding: 24px; max-width: 560px;">
        <p>Hello,</p>
        <p>${escapeHtml(heading)}</p>
        <ul>
          <li><strong>Applicant:</strong> ${escapeHtml(applicantName)}</li>
          <li><strong>Programme:</strong> ${escapeHtml(programme || "Not specified")}</li>
          <li><strong>Application Number:</strong> ${escapeHtml(applicationNumber)}</li>
        </ul>
        ${
          pdf
            ? `<p>The official application summary PDF is attached. Download it to review the printout (including the passport photograph and programme choices), then use your dashboard to approve, reject, or admit the student.</p>`
            : `<p>Open your dashboard to review this student and update their status.</p>`
        }
        <p style="margin: 24px 0;">
          <a href="${escapeHtml(applicationUrl)}" style="display:inline-block;background:#007AFF;color:#ffffff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600;">
            Open dashboard to review
          </a>
        </p>
      </div>
    `,
    attachments: pdf
      ? [
          {
            filename: pdf.filename,
            content: pdf.content.toString("base64"),
            contentType: "application/pdf",
          },
        ]
      : undefined,
  });

  if (result.error) {
    console.error("[sendApplicationSubmittedToSchool]", result.error);
  }
}

export async function sendApplicationStatusUpdateToApplicant(opts: {
  to: string;
  applicantName: string;
  schoolName: string;
  applicationNumber: string;
  status: string;
  programme?: string | null;
  reviewNotes?: string | null;
}): Promise<void> {
  const {
    to,
    applicantName,
    schoolName,
    applicationNumber,
    status,
    programme,
    reviewNotes,
  } = opts;
  const copy = studentStatusCopy(status);
  const portalUrl = absoluteUrl("/dashboard/my-forms");
  const exploreUrl = absoluteUrl("/apply");
  const firstName = applicantName.split(" ")[0] || "there";
  const isCare = copy.tone === "care";
  const accent = isCare ? "#B45309" : copy.tone === "success" ? "#047857" : "#007AFF";

  const text = [
    `Hello ${firstName},`,
    "",
    copy.title,
    "",
    copy.message,
    "",
    `School: ${schoolName}`,
    `Application Number: ${applicationNumber}`,
    programme ? `Programme: ${programme}` : "",
    reviewNotes ? `Note from the school: ${reviewNotes}` : "",
    "",
    `View your application: ${portalUrl}`,
    isCare ? `Explore other programmes: ${exploreUrl}` : "",
    "",
    "With care,",
    "The TertiaryGuide Team",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: copy.emailSubject(schoolName),
    text,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(copy.emailSubject(schoolName))}</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4F6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #E5E7EB;">
          <tr>
            <td style="padding:28px 28px 8px 28px;">
              <p style="margin:0 0 8px 0;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${accent};">${escapeHtml(copy.badge)}</p>
              <h1 style="margin:0;font-family:system-ui,sans-serif;font-size:22px;line-height:1.3;color:#0F172A;">${escapeHtml(copy.title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 8px 28px;font-family:system-ui,sans-serif;font-size:15px;line-height:1.65;color:#334155;">
              <p style="margin:0 0 12px 0;">Hello ${escapeHtml(firstName)},</p>
              <p style="margin:0 0 16px 0;">${escapeHtml(copy.message)}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8FAFC;border-radius:14px;">
                <tr>
                  <td style="padding:14px 16px;font-size:13px;color:#475569;">
                    <p style="margin:0 0 6px 0;"><strong>School:</strong> ${escapeHtml(schoolName)}</p>
                    <p style="margin:0 0 6px 0;"><strong>Application number:</strong> ${escapeHtml(applicationNumber)}</p>
                    ${programme ? `<p style="margin:0;"><strong>Programme:</strong> ${escapeHtml(programme)}</p>` : ""}
                  </td>
                </tr>
              </table>
              ${
                reviewNotes
                  ? `<p style="margin:16px 0 0 0;padding:12px 14px;background:#FFFBEB;border-radius:12px;font-size:13px;"><strong>A note from the school:</strong> ${escapeHtml(reviewNotes)}</p>`
                  : ""
              }
              <p style="margin:22px 0 0 0;">
                <a href="${escapeHtml(portalUrl)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 18px;font-size:14px;font-weight:600;">View your application</a>
              </p>
              ${
                isCare
                  ? `<p style="margin:12px 0 0 0;"><a href="${escapeHtml(exploreUrl)}" style="color:#007AFF;font-size:14px;">Explore other programmes</a></p>`
                  : ""
              }
              <p style="margin:24px 0 0 0;font-size:13px;color:#64748B;">With care,<br/>The TertiaryGuide Team</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  });

  if (result.error) {
    throw new Error(result.error.message || "Failed to send status email");
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendCampaignEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<any> {
  const { to, subject, html } = opts;
  const text = html.replace(/<[^>]*>/g, ""); // basic plain text strip for client fallback

  console.log("[sendCampaignEmail] Sending campaign email", {
    to,
    subject,
    from: FROM_EMAIL,
  });

  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    text,
    html,
  });
}

export async function sendSchoolPortalInviteEmail(opts: {
  to: string;
  schoolName: string;
  loginUrl: string;
  expiresAt: Date;
}): Promise<void> {
  const { to, schoolName, loginUrl, expiresAt } = opts;
  const expiresLabel = expiresAt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const logoUrl = absoluteUrl("/hero/logoTguide.png");
  const siteUrl = absoluteUrl("/");
  const safeSchool = escapeHtml(schoolName);
  const safeLogin = escapeHtml(loginUrl);
  const safeExpires = escapeHtml(expiresLabel);

  const subject = `Your ${schoolName} portal on TertiaryGuide is ready`;

  const text = [
    `Hello from TertiaryGuide,`,
    "",
    `Great news — a school admissions portal has been created for ${schoolName} on TertiaryGuide.`,
    "",
    `Your TertiaryGuide administrators will share the username and password for your school admin account separately. Once you have those credentials, open the secure link below to sign in to your portal:`,
    "",
    loginUrl,
    "",
    `This invitation link expires on ${expiresLabel} (about one month from today).`,
    "",
    `Inside your portal you can manage programmes, applications, branding, deadlines, vouchers, and your school blog.`,
    "",
    `If you did not expect this email, please contact TertiaryGuide support.`,
    "",
    `Warm regards,`,
    `The TertiaryGuide Team`,
    siteUrl,
  ].join("\n");

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    text,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4F6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #E5E7EB;">
          <!-- Header -->
          <tr>
            <td style="padding:28px 32px 20px 32px;background:linear-gradient(180deg,#F0F7FF 0%,#FFFFFF 100%);border-bottom:1px solid #E8EEF5;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" valign="middle">
                    <a href="${escapeHtml(siteUrl)}" style="text-decoration:none;">
                      <img
                        src="${escapeHtml(logoUrl)}"
                        alt="TertiaryGuide"
                        width="168"
                        height="40"
                        style="display:block;height:40px;width:auto;max-width:180px;border:0;"
                      />
                    </a>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display:inline-block;padding:6px 12px;border-radius:9999px;background-color:#007AFF14;color:#007AFF;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">
                      School portal
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero copy -->
          <tr>
            <td style="padding:32px 32px 8px 32px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0F172A;">
              <p style="margin:0 0 8px 0;font-size:13px;font-weight:600;color:#007AFF;letter-spacing:0.02em;">
                Welcome to TertiaryGuide
              </p>
              <h1 style="margin:0 0 12px 0;font-size:26px;line-height:1.25;font-weight:700;color:#0F172A;">
                Your school portal is ready
              </h1>
              <p style="margin:0;font-size:15px;line-height:1.65;color:#475569;">
                An admissions portal has been created for
                <strong style="color:#0F172A;">${safeSchool}</strong>.
                You can now manage applications, programmes, and branding from one place.
              </p>
            </td>
          </tr>

          <!-- Credentials notice -->
          <tr>
            <td style="padding:20px 32px 8px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:16px;">
                <tr>
                  <td style="padding:18px 20px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                    <p style="margin:0 0 6px 0;font-size:13px;font-weight:700;color:#0F172A;">
                      Sign-in credentials
                    </p>
                    <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">
                      Your TertiaryGuide administrators will share the
                      <strong>username</strong> and <strong>password</strong> for
                      your school admin account separately. Once you have them,
                      use the button below to open your portal sign-in page.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:28px 32px 12px 32px;">
              <a
                href="${safeLogin}"
                style="
                  display:inline-block;
                  padding:14px 28px;
                  border-radius:9999px;
                  background-color:#007AFF;
                  color:#ffffff !important;
                  font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                  font-size:15px;
                  font-weight:700;
                  text-decoration:none;
                  box-shadow:0 8px 20px rgba(0,122,255,0.25);
                "
              >Open school portal sign-in</a>
            </td>
          </tr>

          <!-- Expiry -->
          <tr>
            <td style="padding:8px 32px 20px 32px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;" align="center">
              <p style="margin:0;font-size:13px;line-height:1.5;color:#64748B;">
                This invitation link expires on
                <strong style="color:#0F172A;">${safeExpires}</strong>
                &nbsp;·&nbsp; valid for about one month
              </p>
            </td>
          </tr>

          <!-- What you can do -->
          <tr>
            <td style="padding:8px 32px 28px 32px;">
              <p style="margin:0 0 12px 0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;font-weight:700;color:#0F172A;text-transform:uppercase;letter-spacing:0.04em;">
                Inside your portal
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="50%" valign="top" style="padding:0 6px 12px 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8FAFC;border:1px solid #E8EEF5;border-radius:14px;">
                      <tr>
                        <td style="padding:14px 16px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                          <p style="margin:0 0 4px 0;font-size:14px;font-weight:700;color:#0F172A;">Applications</p>
                          <p style="margin:0;font-size:12px;line-height:1.5;color:#64748B;">Review and manage student submissions</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="50%" valign="top" style="padding:0 0 12px 6px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8FAFC;border:1px solid #E8EEF5;border-radius:14px;">
                      <tr>
                        <td style="padding:14px 16px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                          <p style="margin:0 0 4px 0;font-size:14px;font-weight:700;color:#0F172A;">Programmes</p>
                          <p style="margin:0;font-size:12px;line-height:1.5;color:#64748B;">Publish courses and cut-off points</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td width="50%" valign="top" style="padding:0 6px 0 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8FAFC;border:1px solid #E8EEF5;border-radius:14px;">
                      <tr>
                        <td style="padding:14px 16px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                          <p style="margin:0 0 4px 0;font-size:14px;font-weight:700;color:#0F172A;">Branding</p>
                          <p style="margin:0;font-size:12px;line-height:1.5;color:#64748B;">Set colors, voucher price &amp; deadline</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="50%" valign="top" style="padding:0 0 0 6px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8FAFC;border:1px solid #E8EEF5;border-radius:14px;">
                      <tr>
                        <td style="padding:14px 16px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                          <p style="margin:0 0 4px 0;font-size:14px;font-weight:700;color:#0F172A;">School blog</p>
                          <p style="margin:0;font-size:12px;line-height:1.5;color:#64748B;">Share news with applicants</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Fallback link -->
          <tr>
            <td style="padding:0 32px 28px 32px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
              <p style="margin:0 0 6px 0;font-size:12px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:0.04em;">
                Button not working?
              </p>
              <p style="margin:0;font-size:12px;line-height:1.55;color:#64748B;word-break:break-all;">
                Copy and paste this link into your browser:<br />
                <a href="${safeLogin}" style="color:#007AFF;text-decoration:underline;">${safeLogin}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 32px;background-color:#0B1220;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
              <p style="margin:0 0 6px 0;font-size:14px;font-weight:600;color:#FFFFFF;">
                Warm regards,<br />The TertiaryGuide Team
              </p>
              <p style="margin:0 0 12px 0;font-size:12px;line-height:1.5;color:#94A3B8;">
                If you did not expect this email, you can safely ignore it or contact TertiaryGuide support.
              </p>
              <a href="${escapeHtml(siteUrl)}" style="font-size:12px;color:#60A5FA;text-decoration:none;">
                tertiaryguide.com
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  });

  if (result.error) {
    throw new Error(
      result.error.message || "Failed to send school portal invite email",
    );
  }
}

export async function sendAdvertiserPerformanceEmail(opts: {
  to: string;
  advertiserName?: string;
  fromLabel: string;
  toLabel: string;
  summaryHtml: string;
  xlsxBuffer: Buffer;
  filename: string;
}): Promise<void> {
  const { to, advertiserName, fromLabel, toLabel, summaryHtml, xlsxBuffer, filename } =
    opts;
  const greeting = advertiserName?.trim() || "there";
  const subject = `Your TertiaryGuide advertising report (${fromLabel} – ${toLabel})`;
  const text = [
    `Hello ${greeting},`,
    "",
    `Please find attached your advertising performance report for ${fromLabel} to ${toLabel}.`,
    "",
    "This report covers impressions, views, clicks, and click-through rate for your ads and Explore posts on TertiaryGuide. It does not include personal information about people who saw the ads.",
    "",
    "Warm regards,",
    "The TertiaryGuide Team",
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#F8FAFC;font-family:system-ui,sans-serif;color:#0F172A;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0;">
    <tr>
      <td style="padding:24px 28px;background:#007AFF;color:#fff;">
        <p style="margin:0;font-size:18px;font-weight:700;">TertiaryGuide</p>
        <p style="margin:6px 0 0;font-size:13px;opacity:.9;">Advertising performance report</p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 28px;">
        <p style="margin:0 0 12px;font-size:15px;">Hello ${escapeHtml(greeting)},</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155;">
          Attached is your campaign report for <strong>${escapeHtml(fromLabel)}</strong>
          to <strong>${escapeHtml(toLabel)}</strong>. Metrics are aggregated and do not
          include personal data about site visitors.
        </p>
        ${summaryHtml}
        <p style="margin:20px 0 0;font-size:13px;color:#64748B;">
          Warm regards,<br />The TertiaryGuide Team
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    text,
    html,
    attachments: [
      {
        filename,
        content: xlsxBuffer,
      },
    ],
  });

  if (result.error) {
    throw new Error(result.error.message || "Failed to send advertiser report");
  }
}




