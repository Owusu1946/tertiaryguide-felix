import { Resend } from "resend";
import { readFile } from "fs/promises";
import path from "path";
import { absoluteUrl } from "./site-url";

const apiKey = process.env.RESEND_API_KEY;
const fromEmailEnv = process.env.EMAIL_FROM;

if (!apiKey || !fromEmailEnv) {
  // We throw here so it's obvious in development if env is missing.
  throw new Error("RESEND_API_KEY and EMAIL_FROM must be set in environment variables");
}

const resend = new Resend(apiKey);
const FROM_EMAIL: string = fromEmailEnv as string;

async function readPublicImage(relativePath: string): Promise<Buffer> {
  return readFile(path.join(process.cwd(), "public", relativePath));
}

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

  // Resend JSON-encodes attachments — content MUST be base64 strings, not Buffers.
  const [logoB64, exploreB64, compareB64] = await Promise.all([
    readPublicImage("email/welcome-logo.png").then((b) => b.toString("base64")),
    readPublicImage("email/welcome-explore.jpg").then((b) => b.toString("base64")),
    readPublicImage("email/welcome-compare.jpg").then((b) => b.toString("base64")),
  ]);

  const features: { title: string; body: string; href: string }[] = [
      {
        title: "Buy University Application Forms",
      body: "Purchase admission forms for top universities, including teacher training and nursing training, directly through the platform. No queues, no stress.",
        href: formsUrl,
      },
      {
        title: "WASSCE Checker Vouchers",
      body: "Get your WASSCE checker PIN instantly after payment. No more back and forth on WhatsApp groups.",
        href: wassceUrl,
      },
      {
        title: "Find & Compare Programmes",
      body: "Compare programmes across institutions side by side and save days of hunting through PDFs and school websites.",
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
      body: "Our blog and FAQ cover everything from financial aid to thriving in your first semester, especially helpful if you're a first generation applicant navigating this alone.",
        href: blogUrl,
      },
    ];

  const subject = "Welcome to TertiaryGuide";
  const text = [
    greeting,
    "",
    "Welcome to TertiaryGuide",
    "Your account is ready. You're now one step closer to a stress free journey through university admissions, programme search, and WASSCE results.",
    "",
    `Explore More: ${exploreUrl}`,
    "",
    "Try Out Our Latest Compare Feature",
    programmesUrl,
    "",
    "Here's everything you can do on the platform",
    "Built to make tertiary admissions in Ghana simpler, faster, and stress free.",
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
    "www.tertiaryguide.com",
    siteUrl,
  ].join("\n");

  const featureRows = features
    .map(
      (feature, index) => `
          <tr>
            <td style="padding:${index === 0 ? "16px" : "20px"} 0 ${index < features.length - 1 ? "20px" : "0"} 0;${index < features.length - 1 ? "border-bottom:1px solid #E8EEF5;" : ""}font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 6px 0;font-size:16px;font-weight:700;line-height:1.35;color:#0B1220;">
                <a href="${escapeHtml(feature.href)}" style="color:#0B1220;text-decoration:none;">${escapeHtml(feature.title)}</a>
              </p>
              <p style="margin:0;font-size:14px;line-height:1.65;color:#475569;">
                ${escapeHtml(feature.body)}${
                  feature.href === blogUrl
                    ? ` <a href="${escapeHtml(faqsUrl)}" style="color:#007AFF;text-decoration:underline;">Read FAQs</a>`
                    : ""
                }
              </p>
            </td>
          </tr>`,
    )
    .join("");

  const exploreButton = `
              <a href="${escapeHtml(exploreUrl)}" style="display:inline-block;padding:14px 32px;border-radius:8px;background-color:#007AFF;color:#ffffff !important;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;text-decoration:none;line-height:1;">Explore More →</a>`;

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    text,
    attachments: [
      {
        filename: "welcome-logo.png",
        content: logoB64,
        contentType: "image/png",
        contentId: "tg-logo",
      },
      {
        filename: "welcome-explore.jpg",
        content: exploreB64,
        contentType: "image/jpeg",
        contentId: "tg-explore",
      },
      {
        filename: "welcome-compare.jpg",
        content: compareB64,
        contentType: "image/jpeg",
        contentId: "tg-compare",
      },
    ],
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#FFFFFF;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Your account is ready. Explore forms, WASSCE checkers, programmes, and deadlines on TertiaryGuide.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFFFFF;">
    <tr>
      <td align="center" style="padding:0;">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;background-color:#FFFFFF;">
          <tr>
            <td align="left" style="padding:28px 24px 16px 24px;">
              <a href="${escapeHtml(siteUrl)}" style="text-decoration:none;">
                <img src="cid:tg-logo" alt="TertiaryGuide" width="168" height="26" style="display:block;width:168px;height:auto;border:0;outline:none;text-decoration:none;" />
              </a>
            </td>
          </tr>

          <tr>
            <td style="padding:0 24px 8px 24px;">
              <a href="${escapeHtml(exploreUrl)}" style="display:block;text-decoration:none;">
                <img src="cid:tg-explore" alt="Discover Convenience at TertiaryGuide" width="592" style="display:block;width:100%;max-width:592px;height:auto;border:0;outline:none;border-radius:12px;" />
              </a>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 24px 8px 24px;font-family:Arial,Helvetica,sans-serif;color:#0B1220;">
              <p style="margin:0 0 10px 0;font-size:14px;line-height:1.4;color:#64748B;">${escapeHtml(greeting)}</p>
              <h1 style="margin:0 0 12px 0;font-size:30px;line-height:1.2;font-weight:700;color:#0B1220;">
                Welcome to TertiaryGuide
              </h1>
              <p style="margin:0;font-size:16px;line-height:1.65;color:#475569;">
                Your account is ready. You're now one step closer to a stress free journey through university admissions, programme search, and WASSCE results.
              </p>
            </td>
          </tr>

          <tr>
            <td align="left" style="padding:24px 24px 8px 24px;">
              ${exploreButton}
            </td>
          </tr>

          <tr>
            <td style="padding:24px 24px 0 24px;">
              <a href="${escapeHtml(programmesUrl)}" style="display:block;text-decoration:none;">
                <img src="cid:tg-compare" alt="Try Out Our Latest Compare Feature" width="592" style="display:block;width:100%;max-width:592px;height:auto;border:0;outline:none;border-radius:10px;" />
              </a>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 24px 8px 24px;font-family:Arial,Helvetica,sans-serif;">
              <h2 style="margin:0 0 8px 0;font-size:20px;line-height:1.3;font-weight:700;color:#0B1220;">
                Here's everything you can do on the platform
              </h2>
              <p style="margin:0 0 4px 0;font-size:14px;line-height:1.6;color:#64748B;">
                Built to make tertiary admissions in Ghana simpler, faster, and stress free.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${featureRows}
              </table>
            </td>
          </tr>

          <tr>
            <td align="left" style="padding:28px 24px 36px 24px;">
              ${exploreButton}
            </td>
          </tr>

          <tr>
            <td style="padding:20px 24px 36px 24px;border-top:1px solid #E8EEF5;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 4px 0;font-size:14px;font-weight:700;color:#0B1220;">The TertiaryGuide Team</p>
              <a href="${escapeHtml(siteUrl)}" style="font-size:13px;color:#007AFF;text-decoration:none;">www.tertiaryguide.com</a>
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
  myFormsUrl?: string;
}): Promise<void> {
  const {
    to,
    fullName,
    schoolName,
    voucherCode,
    serialNumber,
    applyUrl,
    portalUrl,
    myFormsUrl,
  } = opts;

  // Student-facing labels match Ghana voucher format: Serial + PIN
  const serial = serialNumber;
  const pin = voucherCode;

  if (!to || !to.includes("@")) {
    throw new Error("A valid student email is required to send the voucher");
  }

  const portal =
    portalUrl ||
    `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/apply/portal`;
  const formsUrl = myFormsUrl || absoluteUrl("/dashboard/my-forms");

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
      `View this voucher anytime in My Forms: ${formsUrl}`,
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
            Serial and PIN also appear on your <strong>My Forms</strong> flip cards.
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
          <p style="margin:0 0 10px;text-align:center;">
            <a href="${escapeHtml(formsUrl)}" style="display:inline-block;background:#007AFF;color:#fff;text-decoration:none;padding:10px 16px;border-radius:9999px;font-size:14px;font-weight:600;">
              Open My Forms
            </a>
          </p>
          <p style="margin:0 0 16px;text-align:center;">
            <a href="${escapeHtml(applyUrl)}" style="display:inline-block;background:#0F766E;color:#fff;text-decoration:none;padding:10px 16px;border-radius:9999px;font-size:14px;font-weight:600;">
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

/* -------------------------------------------------------------------------- */
/* Official transactional templates (Application Received / Institution Alert */
/* / Admission Decision)                                                      */
/* -------------------------------------------------------------------------- */

const OFFICIAL_SUPPORT = {
  email: "info@tertiaryguide.com",
  phones: "+233 59 511 0767, +233 24 896 7314",
  address: "Ho, Trafalgar, Ghana",
} as const;

function formatOfficialDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function normalizeDecisionStatus(status: string): string {
  if (status === "accepted" || status === "Accepted") return "Approved";
  return status;
}

function officialFooterText(): string[] {
  return [
    "",
    `Questions? ${OFFICIAL_SUPPORT.email}  ·  ${OFFICIAL_SUPPORT.phones}`,
    OFFICIAL_SUPPORT.address,
    `© TertiaryGuide ${new Date().getFullYear()} · All rights reserved.`,
  ];
}

function officialFooterHtml(): string {
  const year = new Date().getFullYear();
  return `
    <tr>
      <td style="padding:20px 32px 28px;border-top:1px solid #EEF2F7;">
        <p style="margin:0 0 4px;font-size:11px;line-height:1.55;color:#6B7280;">
          Questions?
          <a href="mailto:${OFFICIAL_SUPPORT.email}" style="color:#007AFF;text-decoration:none;">${OFFICIAL_SUPPORT.email}</a>
          · ${escapeHtml(OFFICIAL_SUPPORT.phones)}
        </p>
        <p style="margin:0 0 4px;font-size:11px;color:#9CA3AF;">${escapeHtml(OFFICIAL_SUPPORT.address)}</p>
        <p style="margin:0;font-size:10px;color:#9CA3AF;">© TertiaryGuide ${year} · All rights reserved.</p>
      </td>
    </tr>`;
}

function cleanEmailValue(value: string): string {
  return value
    .replace(/[()[\]{}]/g, "")
    .replace(/\s*[—–-]\s*/g, " · ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function officialDetailTable(
  rows: Array<{ label: string; value: string }>,
): string {
  const body = rows
    .map(
      (row, index) => `
      <tr>
        <td style="padding:10px 0;${index < rows.length - 1 ? "border-bottom:1px solid #EEF2F7;" : ""}width:38%;font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#64748B;vertical-align:top;">
          ${escapeHtml(row.label)}
        </td>
        <td style="padding:10px 0;${index < rows.length - 1 ? "border-bottom:1px solid #EEF2F7;" : ""}font-size:13px;font-weight:600;color:#0F172A;vertical-align:top;">
          ${escapeHtml(cleanEmailValue(row.value))}
        </td>
      </tr>`,
    )
    .join("");
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">
      <tr>
        <td style="padding:2px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table>
        </td>
      </tr>
    </table>`;
}

function officialStepsHtml(
  heading: string,
  steps: Array<{ title: string; body: string }>,
): string {
  const items = steps
    .map(
      (step, i) => `
      <tr>
        <td style="padding:0 0 ${i < steps.length - 1 ? "12px" : "0"};vertical-align:top;width:26px;">
          <span style="display:inline-block;width:22px;height:22px;border-radius:999px;background:#EEF6FF;color:#007AFF;font-size:11px;font-weight:700;line-height:22px;text-align:center;">${i + 1}</span>
        </td>
        <td style="padding:0 0 ${i < steps.length - 1 ? "12px" : "0"};vertical-align:top;">
          <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:#0F172A;">${escapeHtml(step.title)}</p>
          <p style="margin:0;font-size:12px;line-height:1.5;color:#475569;">${step.body}</p>
        </td>
      </tr>`,
    )
    .join("");
  return `
    <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#64748B;">${escapeHtml(heading)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">${items}</table>`;
}

function officialCtaHtml(href: string, label: string, color = "#007AFF"): string {
  return `
    <p style="margin:0 0 18px;text-align:center;">
      <a href="${escapeHtml(href)}" style="display:inline-block;background:${color};color:#ffffff !important;text-decoration:none;padding:11px 20px;border-radius:9999px;font-size:13px;font-weight:700;">
        ${escapeHtml(label)}
      </a>
    </p>`;
}

function officialEmailDocument(opts: {
  subject: string;
  preheader?: string;
  eyebrow?: string;
  eyebrowColor?: string;
  bodyHtml: string;
}): string {
  const logoUrl = absoluteUrl("/hero/logoTguide.png");
  const siteUrl = absoluteUrl("/");
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(opts.preheader)}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(opts.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#E8EEF5;">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E8EEF5;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #DBE7F3;box-shadow:0 12px 28px rgba(15,23,42,0.07);">
          <tr>
            <td style="padding:0;background:#F7FAFF;">
              <div style="height:3px;background:#007AFF;line-height:3px;font-size:0;">&nbsp;</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:22px 28px 18px;">
                    <a href="${escapeHtml(siteUrl)}" style="display:inline-block;text-decoration:none;background:#ffffff;border:1px solid #D6E6FA;border-radius:14px;padding:10px 16px;box-shadow:0 6px 16px rgba(0,122,255,0.08);">
                      <img src="${escapeHtml(logoUrl)}" alt="TertiaryGuide" width="148" height="34" style="display:block;border:0;outline:none;text-decoration:none;height:34px;width:auto;max-width:148px;" />
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 32px 8px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0F172A;">
              ${
                opts.eyebrow
                  ? `<p style="margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${opts.eyebrowColor || "#007AFF"};">${escapeHtml(opts.eyebrow)}</p>`
                  : ""
              }
              ${opts.bodyHtml}
            </td>
          </tr>
          ${officialFooterHtml()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function officialProgrammeChoicesHtml(
  programmes: Array<{ label: string; display: string }>,
): string {
  if (programmes.length === 0) return "";
  const rows = programmes
    .map(
      (row, index) => `
      <tr>
        <td style="padding:10px 0;${index < programmes.length - 1 ? "border-bottom:1px solid #EEF2F7;" : ""}width:32%;font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#64748B;vertical-align:top;">
          ${escapeHtml(cleanEmailValue(row.label))}
        </td>
        <td style="padding:10px 0;${index < programmes.length - 1 ? "border-bottom:1px solid #EEF2F7;" : ""}font-size:13px;font-weight:600;color:#0F172A;vertical-align:top;">
          ${escapeHtml(cleanEmailValue(row.display))}
        </td>
      </tr>`,
    )
    .join("");
  return `
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#64748B;">Programme Choices</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">
      <tr>
        <td style="padding:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
        </td>
      </tr>
    </table>`;
}

/** EMAIL TEMPLATE 01 — Application Received (student confirmation) */
export async function sendApplicationSubmittedToApplicant(opts: {
  to: string;
  applicantName: string;
  schoolName: string;
  applicationNumber: string;
  submittedAt: Date;
  programmes?: Array<{ label: string; display: string }>;
}): Promise<void> {
  const {
    to,
    applicantName,
    schoolName,
    applicationNumber,
    submittedAt,
    programmes = [],
  } = opts;
  const dateStr = formatOfficialDate(submittedAt);
  const trackUrl = absoluteUrl("/dashboard/my-applications");
  const subject = `Application Received · ${schoolName}`;

  const programmeTextLines =
    programmes.length > 0
      ? [
          "Programme Choices",
          ...programmes.map(
            (p) =>
              `${cleanEmailValue(p.label)}: ${cleanEmailValue(p.display)}`,
          ),
          "",
        ]
      : [];

  const text = [
    `Dear ${applicantName},`,
    "",
    "Thank you for submitting your application through TertiaryGuide. We are pleased to confirm that your application to",
    `${schoolName} has been successfully received.`,
    "",
    "Please keep the details below for your records. You may need your Application Number when following up on the status of your application.",
    "",
    "Application Summary",
      `Application Number: ${applicationNumber}`,
    `Institution: ${schoolName}`,
      `Submission Date: ${dateStr}`,
    "Status: Received & Under Review",
    "",
    ...programmeTextLines,
    "What Happens Next?",
    `1. Application Review — The admissions office at ${schoolName} will review your submitted application and documents.`,
    "2. Status Notification — You will receive an email notification as soon as your application status is updated.",
    "3. Track Your Application — Log in to your TertiaryGuide dashboard at any time to check your application progress.",
    "",
    `Track My Application: ${trackUrl}`,
    "",
    `Please note: TertiaryGuide facilitates the submission of your application. Admission decisions are made solely by the institution. If you have questions about your application, please contact ${schoolName} directly.`,
    ...officialFooterText(),
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;">Dear <strong>${escapeHtml(applicantName)}</strong>,</p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#334155;">
      Thank you for submitting your application through TertiaryGuide. We are pleased to confirm that your application to
      <strong>${escapeHtml(schoolName)}</strong> has been successfully received.
    </p>
    <p style="margin:0 0 14px;font-size:13px;line-height:1.55;color:#475569;">
      Please keep the details below for your records. You may need your Application Number when following up on the status of your application.
    </p>
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#64748B;">Application Summary</p>
    ${officialDetailTable([
      { label: "Application Number", value: applicationNumber },
      { label: "Institution", value: schoolName },
      { label: "Submission Date", value: dateStr },
      { label: "Status", value: "Received & Under Review" },
    ])}
    ${officialProgrammeChoicesHtml(programmes)}
    ${officialStepsHtml("What Happens Next?", [
      {
        title: "Application Review",
        body: `The admissions office at <strong>${escapeHtml(schoolName)}</strong> will review your submitted application and documents.`,
      },
      {
        title: "Status Notification",
        body: "You will receive an email notification as soon as your application status is updated.",
      },
      {
        title: "Track Your Application",
        body: "Log in to your TertiaryGuide dashboard at any time to check your application progress.",
      },
    ])}
    ${officialCtaHtml(trackUrl, "Track My Application")}
    <p style="margin:0 0 8px;font-size:12px;line-height:1.55;color:#64748B;">
      <strong>Please note:</strong> TertiaryGuide facilitates the submission of your application. Admission decisions are made solely by the institution. If you have questions about your application, please contact <strong>${escapeHtml(schoolName)}</strong> directly.
    </p>`;

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    text,
    html: officialEmailDocument({
      subject,
      preheader: `Your application to ${schoolName} has been received.`,
      eyebrow: "Application Received",
      bodyHtml,
    }),
  });

  if (result.error) {
    throw new Error(result.error.message || "Failed to send applicant confirmation");
  }
}

/** EMAIL TEMPLATE 02 — New Applicant Notification (institution alert) */
export async function sendApplicationSubmittedToSchool(opts: {
  to: string;
  applicantName: string;
  programme?: string | null;
  programmes?: Array<{ label: string; display: string }>;
  schoolName: string;
  applicationNumber: string;
  applicationUrl: string;
  submittedAt?: Date;
  updated?: boolean;
  pdf?: { filename: string; content: Buffer };
}): Promise<void> {
  const {
    to,
    applicantName,
    programme,
    programmes: programmesOpt,
    schoolName,
    applicationNumber,
    applicationUrl,
    submittedAt = new Date(),
    updated = false,
    pdf,
  } = opts;

  const programmes =
    programmesOpt && programmesOpt.length > 0
      ? programmesOpt
      : programme
        ? [{ label: "1st choice", display: programme }]
        : [];

  const dateStr = formatOfficialDate(submittedAt);
  const subject = updated
    ? `Updated Application · ${applicantName} · ${schoolName}`
    : `New Application · ${applicantName} · ${schoolName}`;

  const programmeTextLines =
    programmes.length > 0
      ? [
          "Programme Choices",
          ...programmes.map(
            (p) =>
              `${cleanEmailValue(p.label)}: ${cleanEmailValue(p.display)}`,
          ),
          "",
        ]
      : [];

  const text = [
    "Dear Admissions Team,",
    "",
    updated
      ? `An applicant has updated their application to ${schoolName} via TertiaryGuide. Please log in to your institution dashboard to review the latest details.`
      : `A new applicant has submitted an application to ${schoolName} via TertiaryGuide. Please log in to your institution dashboard to review, process, and respond to this application promptly.`,
    "",
    "Applicant Details",
    `Applicant Name: ${cleanEmailValue(applicantName)}`,
    `Application Number: ${cleanEmailValue(applicationNumber)}`,
    `Submission Date: ${dateStr}`,
    "Status: Awaiting Review",
    "",
    ...programmeTextLines,
    pdf
      ? "Application Summary PDF Attached — A complete application summary including the applicant's passport photograph, personal information, and programme choices has been attached to this email. Please download and review it before taking action on the dashboard."
      : "Open your institution dashboard to review the full application record.",
    "",
    "Required Actions",
    "1. Download & Review — Open the attached PDF when available to review the applicant's full details, photograph, and programme selections.",
    "2. Log In to Dashboard — Visit your institution dashboard on TertiaryGuide to view the full application record.",
    "3. Take Action — Use the dashboard to Approve, Reject, or Admit the applicant. The student will be notified automatically upon your decision.",
    "",
    `Open Dashboard to Review: ${applicationUrl}`,
    "",
    "Please respond in a timely manner. Applicants are notified in real time when their application status is updated. Prompt responses improve the applicant experience and your institution's credibility on the platform.",
    "",
    "This is an automated notification from TertiaryGuide. Please do not reply to this email.",
    ...officialFooterText(),
    ]
      .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");

  const detailRows = [
    { label: "Applicant Name", value: applicantName },
    { label: "Application Number", value: applicationNumber },
    { label: "Submission Date", value: dateStr },
    { label: "Status", value: "Awaiting Review" },
  ];

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;">Dear Admissions Team,</p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#334155;">
      ${
        updated
          ? `An applicant has updated their application to <strong>${escapeHtml(schoolName)}</strong> via TertiaryGuide. Please log in to your institution dashboard to review the latest details.`
          : `A new applicant has submitted an application to <strong>${escapeHtml(schoolName)}</strong> via TertiaryGuide. Please log in to your institution dashboard to review, process, and respond to this application promptly.`
      }
    </p>
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#64748B;">Applicant Details</p>
    ${officialDetailTable(detailRows)}
    ${officialProgrammeChoicesHtml(programmes)}
        ${
          pdf
        ? `<p style="margin:0 0 14px;padding:12px 14px;background:#F0F7FF;border-left:3px solid #007AFF;border-radius:8px;font-size:12px;line-height:1.55;color:#1E3A5F;">
            <strong>Application Summary PDF Attached</strong> — A complete application summary including the applicant's passport photograph, personal information, and programme choices has been attached. Please download and review it before taking action on the dashboard.
          </p>`
        : ""
    }
    ${officialStepsHtml("Required Actions", [
      {
        title: "Download & Review",
        body: pdf
          ? "Open the attached PDF to review the applicant's full details, photograph, and programme selections."
          : "Review the applicant's full details and programme selections on your dashboard.",
      },
      {
        title: "Log In to Dashboard",
        body: "Visit your institution dashboard on TertiaryGuide to view the full application record.",
      },
      {
        title: "Take Action",
        body: "Use the dashboard to <strong>Approve</strong>, <strong>Reject</strong>, or <strong>Admit</strong> the applicant. The student will be notified automatically upon your decision.",
      },
    ])}
    ${officialCtaHtml(applicationUrl, "Open Dashboard to Review")}
    <p style="margin:0 0 10px;font-size:12px;line-height:1.55;color:#475569;">
      Please respond in a timely manner. Applicants are notified in real time when their application status is updated.
    </p>
    <p style="margin:0;font-size:11px;color:#94A3B8;">
      This is an automated notification from TertiaryGuide. Please do not reply to this email.
    </p>`;

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    text,
    html: officialEmailDocument({
      subject,
      preheader: `${applicantName} applied to ${schoolName}.`,
      eyebrow: updated ? "Updated Application" : "New Applicant Notification",
      eyebrowColor: "#0F766E",
      bodyHtml,
    }),
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

type DecisionVariant = "admitted" | "approved" | "rejected" | "further_review";

function resolveDecisionVariant(status: string): DecisionVariant {
  const normalized = normalizeDecisionStatus(status);
  if (normalized === "Rejected") return "rejected";
  if (normalized === "Admitted") return "admitted";
  if (normalized === "Approved") return "approved";
  return "further_review";
}

/** EMAIL TEMPLATE 03 — Admission Decision (student outcome notification) */
export async function sendApplicationStatusUpdateToApplicant(opts: {
  to: string;
  applicantName: string;
  schoolName: string;
  applicationNumber: string;
  status: string;
  programme?: string | null;
  programmeMode?: string | null;
  reviewNotes?: string | null;
  decisionDate?: Date;
}): Promise<void> {
  const {
    to,
    applicantName,
    schoolName,
    applicationNumber,
    status,
    programme,
    programmeMode,
    reviewNotes,
    decisionDate = new Date(),
  } = opts;

  const variant = resolveDecisionVariant(status);
  const dateStr = formatOfficialDate(decisionDate);
  const trackUrl = absoluteUrl("/dashboard/my-applications");
  const exploreUrl = absoluteUrl("/explore");
  const programmesUrl = absoluteUrl("/program-search");
  const compareUrl = absoluteUrl("/program-search/compare");
  const resourcesUrl = absoluteUrl("/blog");

  let subject: string;
  let eyebrow: string;
  let eyebrowColor: string;
  let preheader: string;
  let text: string;
  let bodyHtml: string;

  if (variant === "admitted") {
    const decisionLabel = "Admitted";
    const programmeLabel = [programme, programmeMode]
      .map((part) => (typeof part === "string" ? part.trim() : ""))
      .filter(Boolean)
      .join(" — ");
    subject = `Congratulations! You've Been Admitted — ${schoolName} | TertiaryGuide`;
    eyebrow = "Admission Offer";
    eyebrowColor = "#047857";
    preheader = programmeLabel
      ? `${schoolName} has offered you admission to ${programmeLabel}.`
      : `${schoolName} has offered you admission.`;
    text = [
      `Dear ${applicantName},`,
      "",
      programmeLabel
        ? `We are delighted to inform you that ${schoolName} has reviewed your application and has offered you admission into ${programmeLabel}. Congratulations on this achievement — your hard work has paid off!`
        : `We are delighted to inform you that ${schoolName} has reviewed your application and has offered you admission into their programme. Congratulations on this achievement — your hard work has paid off!`,
      "",
      "Admission Details",
      `Application Number: ${applicationNumber}`,
      `Institution: ${schoolName}`,
      programmeLabel ? `Programme: ${programmeLabel}` : "",
      `Decision: ${decisionLabel}`,
      `Decision Date: ${dateStr}`,
      reviewNotes ? `Note from the institution: ${reviewNotes}` : "",
      "",
      "Your Next Steps",
      "1. Accept Your Offer — Log in to your TertiaryGuide dashboard (My Applications) and Accept or Decline the offer.",
      `2. Complete Registration — After accepting, contact the admissions office at ${schoolName} to begin your formal enrolment process.`,
      "3. Prepare for Campus Life — Visit our Resources section for guides on hostels, registration, and thriving in your first semester.",
      "",
      `View Admission Letter: ${trackUrl}`,
      "",
      "TertiaryGuide congratulates you on your admission. Please follow all instructions from the institution regarding enrolment deadlines, fees, and documentation to secure your place.",
      ...officialFooterText(),
    ]
      .filter(Boolean)
      .join("\n");

    const admittedDetailRows = [
      { label: "Application Number", value: applicationNumber },
      { label: "Institution", value: schoolName },
      ...(programmeLabel
        ? [{ label: "Programme", value: programmeLabel }]
        : []),
      { label: "Decision", value: decisionLabel },
      { label: "Decision Date", value: dateStr },
    ];

    bodyHtml = `
      <p style="margin:0 0 16px;font-size:16px;">Dear <strong>${escapeHtml(applicantName)}</strong>,</p>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#374151;">
        We are delighted to inform you that <strong>${escapeHtml(schoolName)}</strong> has reviewed your application and has offered you admission${
          programmeLabel
            ? ` into <strong>${escapeHtml(programmeLabel)}</strong>`
            : " into their programme"
        }. Congratulations on this achievement — your hard work has paid off!
      </p>
      <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6B7280;">Admission Details</p>
      ${officialDetailTable(admittedDetailRows)}
      ${
        reviewNotes
          ? `<p style="margin:0 0 18px;padding:12px 14px;background:#ECFDF5;border-radius:12px;font-size:13px;color:#065F46;"><strong>Note from the institution:</strong> ${escapeHtml(reviewNotes)}</p>`
          : ""
      }
      ${officialStepsHtml("Your Next Steps", [
        {
          title: "Accept Your Offer",
          body: "Log in to your TertiaryGuide dashboard (My Applications) and Accept or Decline the offer.",
        },
        {
          title: "Complete Registration",
          body: `After accepting, contact the admissions office at <strong>${escapeHtml(schoolName)}</strong> to begin your formal enrolment process.`,
        },
        {
          title: "Prepare for Campus Life",
          body: `Visit our <a href="${escapeHtml(resourcesUrl)}" style="color:#007AFF;text-decoration:none;">Resources</a> section for guides on hostels, registration, and thriving in your first semester.`,
        },
      ])}
      ${officialCtaHtml(trackUrl, "View Admission Letter →", "#047857")}
      <p style="margin:0;font-size:13px;line-height:1.6;color:#4B5563;">
        TertiaryGuide congratulates you on your admission. Please follow all instructions from the institution regarding enrolment deadlines, fees, and documentation to secure your place.
      </p>`;
  } else if (variant === "approved") {
    const programmeLabel = [programme, programmeMode]
      .map((part) => (typeof part === "string" ? part.trim() : ""))
      .filter(Boolean)
      .join(" · ");
    subject = `Application Approved — ${schoolName} | TertiaryGuide`;
    eyebrow = "Application Approved";
    eyebrowColor = "#047857";
    preheader =
      "After careful review, your application details look clean and correct.";
    text = [
      `Dear ${applicantName},`,
      "",
      `Good news. After a careful review of your details, ${schoolName} confirms that your application looks clean and correct and has been approved.`,
      "",
      "This is not your final admission offer yet. Subsequent information about the next steps in your application process will be shared with you soon. Please keep an eye on your TertiaryGuide dashboard and email for updates.",
      "",
      "Application Reference",
      `Application Number: ${applicationNumber}`,
      `Institution: ${schoolName}`,
      programmeLabel ? `Programme: ${programmeLabel}` : "",
      "Status: Approved",
      `Updated: ${dateStr}`,
      reviewNotes ? `Note from the institution: ${reviewNotes}` : "",
      "",
      `Track My Application: ${trackUrl}`,
      "",
      "Thank you for applying through TertiaryGuide. We will notify you as soon as further information is available.",
      ...officialFooterText(),
    ]
      .filter(Boolean)
      .join("\n");

    const approvedDetailRows = [
      { label: "Application Number", value: applicationNumber },
      { label: "Institution", value: schoolName },
      ...(programmeLabel
        ? [{ label: "Programme", value: programmeLabel }]
        : []),
      { label: "Status", value: "Approved" },
      { label: "Updated", value: dateStr },
    ];

    bodyHtml = `
      <p style="margin:0 0 16px;font-size:16px;">Dear <strong>${escapeHtml(applicantName)}</strong>,</p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#374151;">
        Good news. After a careful review of your details, <strong>${escapeHtml(schoolName)}</strong> confirms that your application looks clean and correct and has been <strong>approved</strong>.
      </p>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#4B5563;">
        This is not your final admission offer yet. Subsequent information about the next steps in your application process will be shared with you soon. Please keep an eye on your TertiaryGuide dashboard and email for updates.
      </p>
      <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6B7280;">Application Reference</p>
      ${officialDetailTable(approvedDetailRows)}
      ${
        reviewNotes
          ? `<p style="margin:0 0 18px;padding:12px 14px;background:#ECFDF5;border-radius:12px;font-size:13px;color:#065F46;"><strong>Note from the institution:</strong> ${escapeHtml(reviewNotes)}</p>`
          : ""
      }
      ${officialCtaHtml(trackUrl, "Track My Application →", "#047857")}
      <p style="margin:0;font-size:13px;line-height:1.6;color:#4B5563;">
        Thank you for applying through TertiaryGuide. We will notify you as soon as further information is available.
      </p>`;
  } else if (variant === "rejected") {
    subject = `Update on Your Application — ${schoolName} | TertiaryGuide`;
    eyebrow = "Application Update";
    eyebrowColor = "#B45309";
    preheader = `An update on your application to ${schoolName}.`;
    text = [
      `Dear ${applicantName},`,
      "",
      `Thank you for applying to ${schoolName} through TertiaryGuide. After careful review of your application, we regret to inform you that the institution is unable to offer you admission at this time.`,
      "",
      "This decision is not a reflection of your potential. Many qualified students apply each year and admissions are highly competitive. We encourage you to keep pursuing your academic goals.",
      "",
      "Application Reference",
    `Application Number: ${applicationNumber}`,
      `Institution: ${schoolName}`,
      "Decision: Not Admitted",
      `Decision Date: ${dateStr}`,
      reviewNotes ? `Note from the institution: ${reviewNotes}` : "",
      "",
      "What You Can Do Next",
      "1. Explore Other Institutions — Browse other institutions and programmes on TertiaryGuide that match your qualifications and interests.",
      "2. Compare Programmes — Use our Programme Search & Compare tool to find alternatives that suit your grades and career goals.",
      "3. Check Scholarships — Visit our Scholarships section to discover funding opportunities that can support your next application.",
      "",
      `Explore Other Programmes: ${programmesUrl}`,
      "",
      "TertiaryGuide remains committed to helping you find the right path. Don't be discouraged — your journey is just beginning. Our team is here to support you every step of the way.",
      ...officialFooterText(),
  ]
    .filter(Boolean)
    .join("\n");

    bodyHtml = `
      <p style="margin:0 0 16px;font-size:16px;">Dear <strong>${escapeHtml(applicantName)}</strong>,</p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#374151;">
        Thank you for applying to <strong>${escapeHtml(schoolName)}</strong> through TertiaryGuide. After careful review of your application, we regret to inform you that the institution is unable to offer you admission at this time.
      </p>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#4B5563;">
        This decision is not a reflection of your potential. Many qualified students apply each year and admissions are highly competitive. We encourage you to keep pursuing your academic goals.
      </p>
      <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6B7280;">Application Reference</p>
      ${officialDetailTable([
        { label: "Application Number", value: applicationNumber },
        { label: "Institution", value: schoolName },
        { label: "Decision", value: "Not Admitted" },
        { label: "Decision Date", value: dateStr },
      ])}
              ${
                reviewNotes
          ? `<p style="margin:0 0 18px;padding:12px 14px;background:#FFFBEB;border-radius:12px;font-size:13px;color:#92400E;"><strong>Note from the institution:</strong> ${escapeHtml(reviewNotes)}</p>`
          : ""
      }
      ${officialStepsHtml("What You Can Do Next", [
        {
          title: "Explore Other Institutions",
          body: `Browse other institutions and programmes on <a href="${escapeHtml(exploreUrl)}" style="color:#007AFF;text-decoration:none;">TertiaryGuide</a> that match your qualifications and interests.`,
        },
        {
          title: "Compare Programmes",
          body: `Use our <a href="${escapeHtml(compareUrl)}" style="color:#007AFF;text-decoration:none;">Programme Search &amp; Compare</a> tool to find alternatives that suit your grades and career goals.`,
        },
        {
          title: "Check Scholarships",
          body: `Visit our <a href="${escapeHtml(exploreUrl)}" style="color:#007AFF;text-decoration:none;">Scholarships</a> section to discover funding opportunities that can support your next application.`,
        },
      ])}
      ${officialCtaHtml(programmesUrl, "Explore Other Programmes →", "#B45309")}
      <p style="margin:0;font-size:13px;line-height:1.6;color:#4B5563;">
        TertiaryGuide remains committed to helping you find the right path. Don't be discouraged — your journey is just beginning. Our team is here to support you every step of the way.
      </p>`;
  } else {
    const programmeLabel = [programme, programmeMode]
      .map((part) => (typeof part === "string" ? part.trim() : ""))
      .filter(Boolean)
      .join(" — ");
    subject = `Your Application is Under Further Review — ${schoolName} | TertiaryGuide`;
    eyebrow = "Further Review";
    eyebrowColor = "#0369A1";
    preheader = `${schoolName} is conducting a further review of your application.`;
    text = [
      `Dear ${applicantName},`,
      "",
      `Thank you for your patience. We would like to update you that ${schoolName} is currently conducting a further review of your application. No final decision has been made yet.`,
      "",
      "You will receive another notification as soon as a final decision is reached. In the meantime, you may continue tracking your application through your TertiaryGuide dashboard.",
      "",
      "Application Reference",
      `Application Number: ${applicationNumber}`,
      `Institution: ${schoolName}`,
      programmeLabel ? `Programme: ${programmeLabel}` : "",
      "Status: Pending Further Review",
      `Last Updated: ${dateStr}`,
      reviewNotes ? `Note from the institution: ${reviewNotes}` : "",
      "",
      `Track My Application: ${trackUrl}`,
      "",
      `If you have not heard back within 14 days, we recommend contacting the admissions office at ${schoolName} directly or reaching out to our support team at ${OFFICIAL_SUPPORT.email} for assistance.`,
      ...officialFooterText(),
    ]
      .filter(Boolean)
      .join("\n");

    const detailRows = [
      { label: "Application Number", value: applicationNumber },
      { label: "Institution", value: schoolName },
      ...(programmeLabel
        ? [{ label: "Programme", value: programmeLabel }]
        : []),
      { label: "Status", value: "Pending Further Review" },
      { label: "Last Updated", value: dateStr },
    ];

    bodyHtml = `
      <p style="margin:0 0 16px;font-size:16px;">Dear <strong>${escapeHtml(applicantName)}</strong>,</p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#374151;">
        Thank you for your patience. We would like to update you that <strong>${escapeHtml(schoolName)}</strong> is currently conducting a further review of your application. No final decision has been made yet.
      </p>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#4B5563;">
        You will receive another notification as soon as a final decision is reached. In the meantime, you may continue tracking your application through your TertiaryGuide dashboard.
      </p>
      <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6B7280;">Application Reference</p>
      ${officialDetailTable(detailRows)}
      ${
        reviewNotes
          ? `<p style="margin:0 0 18px;padding:12px 14px;background:#EFF6FF;border-radius:12px;font-size:13px;color:#1E3A5F;"><strong>Note from the institution:</strong> ${escapeHtml(reviewNotes)}</p>`
          : ""
      }
      ${officialCtaHtml(trackUrl, "Track My Application →", "#0369A1")}
      <p style="margin:0;font-size:13px;line-height:1.6;color:#4B5563;">
        If you have not heard back within 14 days, we recommend contacting the admissions office at <strong>${escapeHtml(schoolName)}</strong> directly or reaching out to our support team at
        <a href="mailto:${OFFICIAL_SUPPORT.email}" style="color:#007AFF;text-decoration:none;">${OFFICIAL_SUPPORT.email}</a> for assistance.
      </p>`;
  }

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    text,
    html: officialEmailDocument({
      subject,
      preheader,
      eyebrow,
      eyebrowColor,
      bodyHtml,
    }),
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




