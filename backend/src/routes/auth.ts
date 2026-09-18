import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

export const authRouter = Router();

// Mock OTP flow — real SMS gateway integration (Dhiraagu/Ooredoo aggregator) is Phase 1 follow-up.
const requestSchema = z.object({ phone: z.string().min(7) });

authRouter.post("/otp/request", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  console.log(`[mock-sms] OTP for ${parsed.data.phone}: 1234`);
  res.json({ sent: true });
});

const verifySchema = z.object({ phone: z.string().min(7), code: z.string(), name: z.string().optional() });

authRouter.post("/otp/verify", async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (parsed.data.code !== "1234") {
    return res.status(401).json({ error: "Invalid code" });
  }
  const user = await prisma.user.upsert({
    where: { phone: parsed.data.phone },
    update: {},
    create: { phone: parsed.data.phone, name: parsed.data.name ?? "New Seller" },
  });
  res.json({ token: `mock-token-${user.id}`, user });
});
