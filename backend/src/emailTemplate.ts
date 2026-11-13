// The one-time code email. Email apps ignore most modern HTML, so this is
// tables and inline styles only (renders the same in Gmail, Outlook and Apple
// Mail), with a plain-text version alongside for clients that block HTML.

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
  const site = (process.env.WEB_ORIGIN || "https://alibe.online").replace(/\/$/, "");
  const logo = `${site}/api/brand/email-logo.png`;
  const { subject, title, lead } = COPY[purpose];
  // Spaced digits are easier to read and type; the hidden copy keeps them
  // together for anyone who long-presses to copy.
  const digits = code
    .split("")
    .map((d) => `<td style="padding:0 4px;"><div style="width:44px;height:56px;line-height:56px;border-radius:12px;background:#FFF3EA;border:1px solid #FFD9BF;font-size:28px;font-weight:800;color:${INK};text-align:center;font-family:'SF Mono',Menlo,Consolas,monospace;">${escape(d)}</div></td>`)
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escape(subject(code))}</title>
</head>
<body style="margin:0;padding:0;background:#F4F1EC;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your Alibe code is ${escape(code)}. It works for 10 minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F1EC;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
      <tr><td align="center" style="padding-bottom:20px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td><img src="${logo}" width="40" height="40" alt="" style="display:block;border-radius:11px;"></td>
          <td style="padding-left:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:22px;font-weight:800;color:${INK};letter-spacing:-0.3px;">Alibe</td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#FFFFFF;border-radius:20px;padding:36px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
        <h1 style="margin:0 0 8px;font-size:24px;line-height:30px;font-weight:800;color:${INK};text-align:center;">${escape(title)}</h1>
        <p style="margin:0 0 28px;font-size:15px;line-height:22px;color:${MUTED};text-align:center;">${escape(lead)}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 12px;"><tr>${digits}</tr></table>
        <p style="margin:0 0 28px;font-size:13px;color:${MUTED};text-align:center;">Works for 10 minutes. Code: <span style="font-weight:700;color:${INK};letter-spacing:1px;">${escape(code)}</span></p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="background:#FFF8E6;border-radius:12px;padding:14px 16px;font-size:14px;line-height:20px;color:${INK};">
            <strong>Never share this code.</strong> Not even with someone who says they work for Alibe. We will never ask you for it.
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:20px 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;line-height:19px;color:${MUTED};text-align:center;">
        Didn't ask for this? You can ignore this email. Nobody can sign in without the code.<br>
        <a href="${site}" style="color:${ORANGE};text-decoration:none;font-weight:700;">Alibe</a> · Buy and sell across the Maldives
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = `${title}

Your Alibe code is ${code}

${lead} It works for 10 minutes.

Never share this code, not even with someone who says they work for Alibe. We will never ask you for it.

Didn't ask for this? You can ignore this email.

Alibe · ${site}`;

  return { subject: subject(code), html, text };
}
