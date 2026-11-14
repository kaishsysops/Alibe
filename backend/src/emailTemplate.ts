// The one-time code email: simple HTML with inline styles (renders the same in
// Gmail, Outlook and Apple Mail), with a plain-text version alongside.

export type CodePurpose = "signin" | "change-email";

const ORANGE = "#FF6A00";
const INK = "#1B2B34";
const MUTED = "#6B7780";

const COPY: Record<CodePurpose, { subject: (code: string) => string; title: string; lead: string }> = {
  signin: {
    subject: (code) => `${code} is your Alibe sign-in code`,
    title: "Your sign-in code",
    lead: "Enter this code in Alibe to sign in.",
  },
  "change-email": {
    subject: (code) => `${code} confirms your new Alibe email`,
    title: "Confirm your email",
    lead: "Enter this code in Alibe to add this email to your account.",
  },
};

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function codeEmail(code: string, purpose: CodePurpose) {
  const { subject, title, lead } = COPY[purpose];

  // The code sits alone in its own block with user-select:all, so one tap or
  // press-and-hold selects exactly the 6 digits (no spaces or nearby words).
  // Deliberately plain: Gmail files image-heavy, linked, designed emails under
  // Promotions. No images, no links, no tagline; just the message and the code.
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject(code))}</title></head>
<body style="margin:0;padding:24px 16px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${INK};">
<div style="max-width:460px;margin:0 auto;">
<p style="margin:0 0 4px;font-size:15px;font-weight:700;color:${ORANGE};">Alibe</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:28px;font-weight:700;">${escape(title)}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:22px;">${escape(lead)}</p>
<div style="margin:0 0 20px;padding:14px 0;border-radius:12px;background:#F4F6F7;text-align:center;font-size:34px;line-height:40px;font-weight:700;letter-spacing:6px;font-family:'SF Mono',Menlo,Consolas,monospace;-webkit-user-select:all;user-select:all;">${escape(code)}</div>
<p style="margin:0 0 20px;font-size:13px;line-height:19px;color:${MUTED};">Press and hold the code to copy it, then tap Paste code in Alibe.</p>
<p style="margin:0 0 20px;font-size:15px;line-height:22px;">It works for 10 minutes. Never share it with anyone, not even someone who says they work for Alibe. We will never ask you for it.</p>
<p style="margin:0;font-size:13px;line-height:19px;color:${MUTED};">Didn't ask for this? You can ignore this email. Nobody can sign in without the code.</p>
</div>
</body>
</html>`;

  const text = `${title}

Your Alibe code is ${code}

${lead} It works for 10 minutes.

Never share this code, not even with someone who says they work for Alibe. We will never ask you for it.

Didn't ask for this? You can ignore this email.

Alibe`;

  return { subject: subject(code), html, text };
}
