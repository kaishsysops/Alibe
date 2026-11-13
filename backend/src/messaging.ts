// Delivers one-time codes. Without a provider, development falls back to the
// backend log and the app shows the code on screen; production refuses to
// pretend, so a missing provider can never mean a code anyone can read.
// SHOW_CODES_IN_APP=true is the one exception: a production build used as a
// test server before SMS/email exist. Anyone can sign in as anyone while it's
// on, so it must be off once real people use the app.
const isProduction = process.env.NODE_ENV === "production" && process.env.SHOW_CODES_IN_APP !== "true";
if (process.env.NODE_ENV === "production" && !isProduction) {
  console.warn("WARNING: SHOW_CODES_IN_APP=true. Sign-in codes are shown in the app. Test server only.");
}

// `shownInApp` tells the sign-in route to hand the code back to the app.
export type Delivery = { shownInApp: boolean };

function developmentOnly(kind: string, to: string, code: string): Delivery {
  if (isProduction) throw new Error(`No ${kind} provider configured`);
  console.log(`[dev-${kind}] Code for ${to}: ${code}`);
  return { shownInApp: true };
}

export async function sendEmailCode(to: string, code: string): Promise<Delivery> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return developmentOnly("email", to, code);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.MAIL_FROM ?? "Alibe <no-reply@alibe.mv>",
      to,
      subject: `${code} is your Alibe code`,
      text: `Your Alibe code is ${code}.\n\nIt works for 10 minutes. Never share it with anyone, not even someone saying they work for Alibe.\n\nDidn't ask for this? You can ignore this email.`,
    }),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}`);
  return { shownInApp: false };
}

// The SMS gateway (Dhiraagu/Ooredoo aggregator) plugs in here.
export async function sendSmsCode(to: string, code: string): Promise<Delivery> {
  return developmentOnly("sms", to, code);
}

// Which sign-in methods can actually deliver a code right now. The app only
// offers these, so nobody waits for a code that can't arrive. In test mode
// (codes shown in the app) both work.
export function deliveryMethods() {
  const shown = !isProduction;
  return {
    email: shown || !!process.env.RESEND_API_KEY,
    // The SMS gateway isn't connected yet (sendSmsCode above).
    phone: shown,
  };
}
