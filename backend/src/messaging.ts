import { codeEmail, CodePurpose } from "./emailTemplate.js";

// Delivers one-time codes. Without a provider, development falls back to the
// backend log and the app shows the code on screen; production refuses to
// pretend, so a missing provider can never mean a code anyone can read.
const isProduction = process.env.NODE_ENV === "production";

// `shownInApp` tells the sign-in route to hand the code back to the app.
export type Delivery = { shownInApp: boolean };

function developmentOnly(kind: string, to: string, code: string): Delivery {
  if (isProduction) throw new Error(`No ${kind} provider configured`);
  console.log(`[dev-${kind}] Code for ${to}: ${code}`);
  return { shownInApp: true };
}

export async function sendEmailCode(to: string, code: string, purpose: CodePurpose = "signin"): Promise<Delivery> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return developmentOnly("email", to, code);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.MAIL_FROM ?? "Alibe <no-reply@alibe.online>",
      to,
      ...codeEmail(code, purpose),
    }),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}`);
  return { shownInApp: false };
}

// The SMS gateway (Dhiraagu/Ooredoo aggregator) plugs in here.
export async function sendSmsCode(to: string, code: string): Promise<Delivery> {
  return developmentOnly("sms", to, code);
}

// Which sign-in methods are on. Email only for now: phone sign-in (and the
// phone-number requirement for selling) is off until an SMS gateway is
// connected in sendSmsCode and PHONE_SIGN_IN=true is set.
export function deliveryMethods() {
  return {
    email: !isProduction || !!process.env.RESEND_API_KEY,
    phone: process.env.PHONE_SIGN_IN === "true",
  };
}
