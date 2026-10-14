import { z } from "zod";
import { prisma } from "../db.js";
import { safeRouter, PHONE_REGEX, normalizePhone } from "../http.js";
import { createSession, deleteSession } from "../auth.js";

export const authRouter = safeRouter();

// Mock OTP flow — real SMS gateway integration (Dhiraagu/Ooredoo aggregator) is Phase 1 follow-up.
const requestSchema = z.object({ phone: z.string().transform(normalizePhone) });

authRouter.post("/otp/request", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success || !PHONE_REGEX.test(parsed.data.phone)) {
    return res.status(400).json({ error: "Please enter a valid phone number, e.g. +960 7771234." });
  }
  console.log(`[mock-sms] OTP for ${parsed.data.phone}: 1234`);
  res.json({ sent: true });
});

const verifySchema = z.object({
  phone: z.string().transform(normalizePhone),
  code: z.string(),
  name: z.string().optional(),
  themeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

authRouter.post("/otp/verify", async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please enter the code we sent you." });
  if (parsed.data.code !== "1234") {
    return res.status(401).json({ error: "That code isn't right. Please try again." });
  }
  const { phone, name, themeColor } = parsed.data;
  const user = await prisma.user.upsert({
    where: { phone },
    // Returning users keep the colour they saved; the device's colour only seeds new accounts.
    update: {},
    create: { phone, name: name ?? "New Seller", themeColor },
  });
  res.json({ token: await createSession(user.id), user });
});

// Signs this device out: its token stops working immediately, and its push
// token is dropped so the next person on the phone doesn't get our pushes.
authRouter.post("/logout", async (req, res) => {
  const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  const pushToken = typeof req.body?.pushToken === "string" ? req.body.pushToken : null;
  if (pushToken && req.userId) {
    await prisma.$executeRaw`UPDATE "User" SET "pushTokens" = array_remove("pushTokens", ${pushToken}) WHERE id = ${req.userId}`;
  }
  if (token) await deleteSession(token);
  res.status(204).send();
});
