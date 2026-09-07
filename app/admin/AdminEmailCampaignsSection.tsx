"use client";

import React, { useEffect, useState } from "react";
import { Mail, History, Send, CheckCircle2, AlertCircle, Eye, Plus, Settings2 } from "lucide-react";

import { BlogEditor } from "@/components/tiptap-templates/blog-editor";

interface CampaignHistoryItem {
  id: string;
  subject: string;
  contentHtml: string;
  target: string;
  singleEmail: string | null;
  totalEmails: number;
  successCount: number;
  failureCount: number;
  sentAt: string;
  status: string;
}

export function AdminEmailCampaignsSection() {
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [editorMode, setEditorMode] = useState<"visual" | "html">("visual");
  
  // New campaign state
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [template, setTemplate] = useState("announcement");
  const [target, setTarget] = useState<"all" | "form-buyers" | "single" | "school" | "approaching-deadlines">("single");
  const [schoolKey, setSchoolKey] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("30");
  const [schools, setSchools] = useState<Array<{ name: string; slug?: string | null; alias?: string | null }>>([]);
  const [singleEmail, setSingleEmail] = useState("");
  const [htmlContent, setHtmlContent] = useState(`<h2>Hello from TertiaryGuide!</h2>
<p>We are excited to share some updates with you.</p>
<p>Best regards,<br/>The TertiaryGuide Team</p>`);
  const [buttonLabel, setButtonLabel] = useState("Learn more");
  const [buttonUrl, setButtonUrl] = useState("https://tertiaryguide.com");
  const [buttonColor, setButtonColor] = useState("#374151");
  const [footer, setFooter] = useState({
    location: "Ho, Trafalgar, Ghana",
    phone: "+233 59 511 0767",
    phoneSecondary: "+233 24 896 7314",
    email: "info@tertiaryguide.com",
    instagram: "https://www.instagram.com/tertiaryguide1",
    facebook: "https://www.facebook.com/share/1EAdiVWy5T/",
    twitter: "https://x.com/TertiaryGuide1",
    tiktok: "https://www.tiktok.com/@tertiaryguide",
    youtube: "https://youtube.com/@tertiaryguide",
  });

  const adminHeaders = (): Record<string, string> => {
    const username = typeof window !== "undefined" ? window.localStorage.getItem("tg_admin_username") : null;
    return username ? { "x-admin-username": username } : {};
  };

  const applyTemplate = (value: string) => {
    setTemplate(value);
    const templates: Record<string, { subject: string; preview: string; html: string }> = {
      announcement: { subject: "An update from TertiaryGuide", preview: "The latest news and updates from TertiaryGuide.", html: "<h2>What’s new at TertiaryGuide?</h2><p>We’re sharing a short update to help you plan your next step in tertiary education.</p><p>Visit TertiaryGuide to learn more.</p>" },
      deadline: { subject: "Important admissions deadline", preview: "A reminder about an upcoming admissions deadline.", html: "<h2>Important admissions deadline</h2><p>Please take a moment to review the upcoming deadline and complete your application in good time.</p>" },
      newsletter: { subject: "TertiaryGuide newsletter", preview: "News, opportunities, and practical guidance for applicants.", html: "<h2>Your TertiaryGuide update</h2><p>Here are the latest opportunities, guidance, and resources for your tertiary education journey.</p>" },
      blank: { subject: "", preview: "", html: "<p>Write your message here.</p>" },
    };
    const next = templates[value] || templates.announcement;
    setSubject(next.subject);
    setPreviewText(next.preview);
    setHtmlContent(next.html);
  };

  const insertButton = () => {
    const label = buttonLabel.trim() || "Learn more";
    const url = buttonUrl.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      alert("Use a complete button URL beginning with https://");
      return;
    }
    const buttonHtml = `<p style="margin:24px 0;text-align:left;"><a href="${url.replace(/\"/g, "&quot;")}" style="display:inline-block;background:${buttonColor};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:4px;font-weight:600;">${label.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</a></p>`;
    setHtmlContent((current) => `${current}${buttonHtml}`);
  };
  
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    success: boolean;
    message: string;
    stats?: { total: number; successCount: number; failureCount: number };
  } | null>(null);

  // History state
  const [campaigns, setCampaigns] = useState<CampaignHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      const res = await fetch("/api/admin/email-campaigns", { headers: adminHeaders() });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load campaign history");
      }
      setCampaigns(data.campaigns || []);
    } catch (err: any) {
      setHistoryError(err.message || "Failed to load campaign history");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history") {
      void loadHistory();
    }
  }, [activeTab]);

  useEffect(() => {
    void fetch("/api/admin/schools", { headers: adminHeaders() }).then((res) => res.ok ? res.json() : null).then((data) => setSchools(data?.schools || [])).catch(() => undefined);
  }, []);

  const handleSendCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      alert("Please enter a subject line.");
      return;
    }
    if (!htmlContent.trim()) {
      alert("Please enter HTML content for the email body.");
      return;
    }
    if (target === "single" && !singleEmail.trim()) {
      alert("Please specify the recipient email address.");
      return;
    }
    if (target === "school" && !schoolKey) {
      alert("Please choose a school to feature.");
      return;
    }

    if (!confirm(`Are you sure you want to send this campaign to ${target === "single" ? singleEmail : target}?`)) {
      return;
    }

    try {
      setSending(true);
      setSendResult(null);

      const res = await fetch("/api/admin/email-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({
          subject,
          previewText,
          htmlContent,
          footer,
          target,
          schoolKey: target === "school" ? schoolKey : undefined,
          deadlineDays: target === "approaching-deadlines" ? Number(deadlineDays) : undefined,
          singleEmail: target === "single" ? singleEmail : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to dispatch campaign");
      }

      setSendResult({
        success: true,
        message: data.message || "Campaign sent successfully",
        stats: data.stats,
      });

      // Reset form if successful
      if (target === "single") {
        // Keep subject and html content for testing convenience
      } else {
        setSubject("");
        setHtmlContent("<h2>Hello!</h2>");
      }
    } catch (err: any) {
      setSendResult({
        success: false,
        message: err.message || "Failed to send email campaign",
      });
    } finally {
      setSending(false);
    }
  };

  const getTargetBadgeLabel = (t: string, singleEmail?: string | null) => {
    if (t === "all") return "All Users";
    if (t === "form-buyers") return "Form Buyers";
    if (t === "school") return "School Feature";
    if (t === "approaching-deadlines") return "Approaching Deadlines";
    if (t === "single") return singleEmail ? `Single (${singleEmail})` : "Single Recipient";
    return t;
  };

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <p className="text-xs font-medium text-[#9CA3AF]">
          Dashboard / <span className="text-[#111827]">Email Campaigns</span>
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827] md:text-3xl">
          Email Campaigns
        </h1>
        <p className="text-xs text-[#6B7280]">
          Create, preview, and dispatch email campaigns to users or check history of sent campaigns.
        </p>
      </section>

      {/* Campaign Tabs */}
      <div className="flex border-b border-[#E5E7EB] text-sm">
        <button
          type="button"
          onClick={() => setActiveTab("new")}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition-all ${
            activeTab === "new"
              ? "border-[#2563EB] text-[#2563EB]"
              : "border-transparent text-[#6B7280] hover:text-[#111827]"
          }`}
        >
          <Mail className="h-4 w-4" />
          New Campaign
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition-all ${
            activeTab === "history"
              ? "border-[#2563EB] text-[#2563EB]"
              : "border-transparent text-[#6B7280] hover:text-[#111827]"
          }`}
        >
          <History className="h-4 w-4" />
          Campaign History
        </button>
      </div>

      {activeTab === "new" ? (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          {/* Creator Form */}
          <form onSubmit={handleSendCampaign} className="space-y-5 rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-[#111827]">Design Campaign</h2>

            {sendResult && (
              <div
                className={`flex gap-3 rounded-xl p-4 text-xs ${
                  sendResult.success
                    ? "bg-[#DCFCE7] text-[#14532D]"
                    : "bg-[#FEE2E2] text-[#7F1D1D]"
                }`}
              >
                {sendResult.success ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#16A34A]" />
                ) : (
                  <AlertCircle className="h-5 w-5 shrink-0 text-[#DC2626]" />
                )}
                <div>
                  <p className="font-semibold">{sendResult.message}</p>
                  {sendResult.stats && (
                    <p className="mt-1 opacity-90">
                      Total: {sendResult.stats.total} | Success: {sendResult.stats.successCount} | Failed: {sendResult.stats.failureCount}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="campaign-template" className="text-xs font-semibold text-[#374151]">Template</label>
              <select id="campaign-template" value={template} onChange={(e) => applyTemplate(e.target.value)} className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm text-[#111827] focus:border-[#374151] focus:outline-none focus:ring-1 focus:ring-[#374151]">
                <option value="announcement">General announcement</option>
                <option value="deadline">Admissions deadline</option>
                <option value="newsletter">Newsletter</option>
                <option value="blank">Blank email</option>
              </select>
            </div>

            <details className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA]">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-semibold text-[#374151]"><Settings2 className="h-4 w-4" /> Customize footer and contact details</summary>
              <div className="grid gap-3 border-t border-[#E5E7EB] p-3 sm:grid-cols-2">
                {(["location", "phone", "phoneSecondary", "email", "instagram", "facebook", "twitter", "tiktok", "youtube"] as const).map((key) => (
                  <label key={key} className="space-y-1 text-[11px] font-medium text-[#4B5563]">
                    <span>{key === "phoneSecondary" ? "Second phone" : key[0].toUpperCase() + key.slice(1)}</span>
                    <input value={footer[key]} onChange={(e) => setFooter((current) => ({ ...current, [key]: e.target.value }))} className="w-full rounded-md border border-[#D1D5DB] bg-white px-2.5 py-2 text-xs text-[#111827] focus:border-[#374151] focus:outline-none" />
                  </label>
                ))}
              </div>
            </details>

            <div className="space-y-1.5">
              <label htmlFor="campaign-subject" className="text-xs font-semibold text-[#374151]">
                Subject Line
              </label>
              <input
                id="campaign-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Early Bird Discounts for University Vouchers!"
                className="w-full rounded-xl border border-[#D1D5DB] px-3.5 py-2 text-sm text-[#111827] placeholder-gray-400 focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="campaign-preview" className="text-xs font-semibold text-[#374151]">Preview text <span className="font-normal text-[#6B7280]">(optional)</span></label>
              <input id="campaign-preview" type="text" value={previewText} onChange={(e) => setPreviewText(e.target.value)} placeholder="Short line shown beside the subject in an inbox" className="w-full rounded-lg border border-[#D1D5DB] px-3.5 py-2 text-sm text-[#111827] placeholder-gray-400 focus:border-[#374151] focus:outline-none focus:ring-1 focus:ring-[#374151]" />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="campaign-target" className="text-xs font-semibold text-[#374151]">
                Target Audience
              </label>
              <select
                id="campaign-target"
                value={target}
                onChange={(e) => { const next = e.target.value as typeof target; setTarget(next); if (next === "approaching-deadlines" && !htmlContent.includes("{approaching-deadlines}")) setHtmlContent((current) => `${current}\n{approaching-deadlines}`); }}
                className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm text-[#111827] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              >
                <option value="single">Single Test Email Recipient</option>
                <option value="all">All Registered Users</option>
                <option value="form-buyers">Form Voucher Buyers</option>
                <option value="school">One school (all users)</option>
                <option value="approaching-deadlines">Approaching deadlines (all users)</option>
              </select>
            </div>

            {target === "single" && (
              <div className="space-y-1.5">
                <label htmlFor="campaign-single-email" className="text-xs font-semibold text-[#374151]">
                  Recipient Email
                </label>
                <input
                  id="campaign-single-email"
                  type="email"
                  value={singleEmail}
                  onChange={(e) => setSingleEmail(e.target.value)}
                  placeholder="e.g. test@example.com"
                  className="w-full rounded-xl border border-[#D1D5DB] px-3.5 py-2 text-sm text-[#111827] placeholder-gray-400 focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                  required={target === "single"}
                />
              </div>
            )}

            {target === "school" && (
              <div className="space-y-1.5"><label htmlFor="campaign-school" className="text-xs font-semibold text-[#374151]">School to feature</label><select id="campaign-school" value={schoolKey} onChange={(e) => { setSchoolKey(e.target.value); setHtmlContent((current) => `${current}\n<p>{schoolKey ? "" : ""}</p>`.replace("<p></p>", `{school:${e.target.value}}`)); }} className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm"><option value="">Choose a school</option>{schools.map((school) => <option key={school.slug || school.name} value={school.slug || school.name}>{school.alias || school.name}</option>)}</select><p className="text-[11px] text-[#6B7280]">The selected school card includes its logo, deadline, and admissions link.</p></div>
            )}
            {target === "approaching-deadlines" && (
              <div className="space-y-1.5"><label htmlFor="deadline-days" className="text-xs font-semibold text-[#374151]">Include deadlines within</label><select id="deadline-days" value={deadlineDays} onChange={(e) => setDeadlineDays(e.target.value)} className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm"><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select><p className="text-[11px] text-[#6B7280]">Use the token <code>{"{approaching-deadlines}"}</code> in the message where the school cards should appear.</p></div>
            )}

            <div className="space-y-1.5">
              <div className="flex justify-between items-center pb-1">
                <span className="text-xs font-semibold text-[#374151]">Email Body Content</span>
                <div className="flex bg-[#F3F4F6] p-0.5 rounded-lg text-[10px] font-medium border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setEditorMode("visual")}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      editorMode === "visual"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    ✏️ Visual
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode("html")}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      editorMode === "html"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    💻 HTML Source
                  </button>
                </div>
              </div>

              {editorMode === "visual" ? (
                <div className="min-h-[250px] border border-gray-200 rounded-xl overflow-hidden bg-white">
                  <BlogEditor value={htmlContent} onChange={setHtmlContent} />
                </div>
              ) : (
                <textarea
                  id="campaign-html"
                  rows={14}
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  placeholder="Write HTML formatted content..."
                  className="w-full font-mono rounded-xl border border-[#D1D5DB] p-3.5 text-xs text-[#111827] placeholder-gray-400 focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                  required
                />
              )}
            </div>

            <details className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA]">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-semibold text-[#374151]"><Plus className="h-4 w-4" /> Add email button</summary>
              <div className="grid gap-3 border-t border-[#E5E7EB] p-3 sm:grid-cols-[1fr_1.4fr_auto]">
                <input value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} placeholder="Button label" className="rounded-md border border-[#D1D5DB] px-2.5 py-2 text-xs" />
                <input value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} placeholder="https://example.com" className="rounded-md border border-[#D1D5DB] px-2.5 py-2 text-xs" />
                <div className="flex items-center gap-2"><input type="color" value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} className="h-9 w-10 cursor-pointer rounded border border-[#D1D5DB] bg-white p-1" /><button type="button" onClick={insertButton} className="inline-flex items-center gap-1.5 rounded-md bg-[#374151] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1F2937]"><Plus className="h-3.5 w-3.5" /> Insert</button></div>
              </div>
            </details>

            <button
              type="submit"
              disabled={sending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] disabled:opacity-50"
            >
              {sending ? (
                <>
                  <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending Campaign...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Campaign
                </>
              )}
            </button>
          </form>

          {/* Live Preview Panel */}
          <div className="flex flex-col rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-5">
            <div className="flex items-center gap-2 pb-3 border-b border-[#E5E7EB] text-[#374151]">
              <Eye className="h-4 w-4 text-[#2563EB]" />
              <h2 className="text-sm font-semibold">Live Email Preview</h2>
            </div>
            
            <div className="mt-4 flex-1 rounded-lg border border-[#E5E7EB] bg-[#F4F5F7] overflow-hidden flex flex-col min-h-[350px]">
              <div className="bg-[#F3F4F6] border-b border-[#E5E7EB] px-4 py-2 text-[11px] text-[#6B7280]">
                <p><strong>From:</strong> TertiaryGuide &lt;no-reply@ventrapos.com&gt;</p>
                <p className="truncate"><strong>Subject:</strong> {subject || "(No Subject Specified)"}</p>
              </div>
              
              <iframe
                title="Email Preview"
                srcDoc={`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2933}a{color:#374151}img{max-width:100%;height:auto}</style></head><body><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:20px 8px;background:#f4f5f7"><tr><td align="center"><table width="100%" style="max-width:620px;background:#fff;border:1px solid #e5e7eb" cellspacing="0" cellpadding="0"><tr><td style="padding:20px 24px;border-bottom:1px solid #e5e7eb"><img src="/hero/full-logo.png" width="205" style="display:block;width:205px;height:auto" alt="TertiaryGuide"></td></tr><tr><td style="padding:28px 24px;font-size:15px;line-height:1.6">${htmlContent}</td></tr><tr><td style="padding:20px 24px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px"><strong style="color:#374151">TertiaryGuide</strong><br>${footer.location}<br>${footer.phone} ${footer.phoneSecondary ? `| ${footer.phoneSecondary}` : ""}<br><a href="mailto:${footer.email}">${footer.email}</a><br><span>${footer.instagram ? "Instagram" : ""}${footer.facebook ? " | Facebook" : ""}${footer.twitter ? " | X" : ""}${footer.tiktok ? " | TikTok" : ""}${footer.youtube ? " | YouTube" : ""}</span><br><a href="/dashboard/notification">Manage email preferences</a></td></tr></table></td></tr></table></body></html>`}
                className="w-full flex-1 border-0 bg-white"
              />
            </div>
          </div>
        </div>
      ) : (
        /* History View */
        <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-xs font-semibold text-[#4B5563]">
                  <th className="px-5 py-3.5">Subject</th>
                  <th className="px-5 py-3.5">Target</th>
                  <th className="px-5 py-3.5">Sent Date</th>
                  <th className="px-5 py-3.5">Delivered / Failed</th>
                  <th className="px-5 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-xs text-[#111827]">
                {historyLoading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-3 w-48 rounded bg-[#E5E7EB]" /></td>
                      <td className="px-5 py-4"><div className="h-3 w-20 rounded bg-[#E5E7EB]" /></td>
                      <td className="px-5 py-4"><div className="h-3 w-24 rounded bg-[#E5E7EB]" /></td>
                      <td className="px-5 py-4"><div className="h-3 w-16 rounded bg-[#E5E7EB]" /></td>
                      <td className="px-5 py-4 text-right"><div className="ml-auto h-3 w-14 rounded bg-[#E5E7EB]" /></td>
                    </tr>
                  ))
                ) : historyError ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-[#DC2626] font-medium">
                      {historyError}
                    </td>
                  </tr>
                ) : campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-[#6B7280]">
                      No email campaigns have been sent yet. Click &quot;New Campaign&quot; above to get started.
                    </td>
                  </tr>
                ) : (
                  campaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-5 py-4 font-medium text-[#111827] max-w-xs truncate" title={c.subject}>
                        {c.subject}
                      </td>
                      <td className="px-5 py-4 text-[#4B5563]">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700">
                          {getTargetBadgeLabel(c.target, c.singleEmail)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-[#6B7280]">
                        {c.sentAt ? new Date(c.sentAt).toLocaleString("en-US", {
                          month: "short",
                          day: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }) : "—"}
                      </td>
                      <td className="px-5 py-4 font-semibold">
                        <span className="text-[#16A34A]">{c.successCount}</span>
                        <span className="text-gray-400 mx-1">/</span>
                        <span className={c.failureCount > 0 ? "text-[#DC2626]" : "text-gray-400"}>
                          {c.failureCount}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            c.status === "Success"
                              ? "bg-[#DCFCE7] text-[#14532D]"
                              : c.status === "Partial Success"
                              ? "bg-[#FEF3C7] text-[#78350F]"
                              : "bg-[#FEE2E2] text-[#7F1D1D]"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
