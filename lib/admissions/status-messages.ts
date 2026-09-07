export type StudentStatusTone = "neutral" | "info" | "success" | "care";

export type StudentStatusCopy = {
  badge: string;
  title: string;
  message: string;
  tone: StudentStatusTone;
  emailSubject: (schoolName: string) => string;
  emailPreview: string;
};

function normalizeStatus(status: string): string {
  if (status === "accepted" || status === "Accepted") return "Approved";
  return status;
}

export function studentStatusCopy(status: string): StudentStatusCopy {
  switch (normalizeStatus(status)) {
    case "Pending":
      return {
        badge: "Received",
        title: "We’ve received your application",
        message:
          "Thank you for applying. The admissions team will review your form and update you here — and by email — when there’s news.",
        tone: "neutral",
        emailSubject: (school) =>
          `Application Received — ${school} | TertiaryGuide`,
        emailPreview: "Your application has been successfully received.",
      };
    case "Under Review":
      return {
        badge: "Under further review",
        title: "Your application is under further review",
        message:
          "The admissions team is conducting a further review of your application. No final decision has been made yet — you’ll be notified as soon as there is an update.",
        tone: "info",
        emailSubject: (school) =>
          `Your Application is Under Further Review — ${school} | TertiaryGuide`,
        emailPreview: "Your application is under further review.",
      };
    case "Approved":
      return {
        badge: "Approved",
        title: "Your application details have been approved",
        message:
          "After a careful review of your details, your application looks clean and correct and has been approved. Subsequent information about the next steps will be shared with you soon — please watch this page and your email.",
        tone: "success",
        emailSubject: (school) =>
          `Application Approved — ${school} | TertiaryGuide`,
        emailPreview:
          "Your application details have been reviewed and approved.",
      };
    case "Admitted":
      return {
        badge: "Admitted",
        title: "Congratulations — you’ve been offered admission",
        message:
          "We’re delighted to share that the school has offered you a place. Check your email for enrolment details, and keep this page handy as your application record.",
        tone: "success",
        emailSubject: (school) =>
          `Congratulations! You've Been Admitted — ${school} | TertiaryGuide`,
        emailPreview: "You’ve been offered admission.",
      };
    case "Rejected":
      return {
        badge: "Not admitted",
        title: "Update on your application",
        message:
          "After careful review, the institution is unable to offer you admission at this time. That doesn’t take away from the work you put in — explore other programmes on TertiaryGuide whenever you’re ready.",
        tone: "care",
        emailSubject: (school) =>
          `Update on Your Application — ${school} | TertiaryGuide`,
        emailPreview: "An update on your application.",
      };
    default:
      return {
        badge: status || "Update",
        title: "Your application has been updated",
        message:
          "There’s a new update on your application. Please check this page for the latest details from the school.",
        tone: "neutral",
        emailSubject: (school) =>
          `Update on Your Application — ${school} | TertiaryGuide`,
        emailPreview: "Your application status has been updated.",
      };
  }
}

export function studentStatusBadgeClass(status: string): string {
  switch (studentStatusCopy(status).tone) {
    case "success":
      return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100";
    case "info":
      return "bg-sky-50 text-sky-800 ring-1 ring-sky-100";
    case "care":
      return "bg-amber-50 text-amber-900 ring-1 ring-amber-100";
    default:
      return "bg-slate-50 text-slate-700 ring-1 ring-slate-100";
  }
}
