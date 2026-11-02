import { prisma } from "./db.js";
import { verifyPassword } from "./password.js";

// Staff sign-in has no visible way in: it opens when the secret number is typed
// into the phone field. The number is only ever checked here, because anything
// shipped in the app can be read out of it. It keeps strangers away from the
// password form; the password is still what proves who you are.
export const STAFF_CODE_KEY = "staffEntryCode";
export const STAFF_CODE_LENGTH = 8;

export async function isStaffCode(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.length !== STAFF_CODE_LENGTH) return false;
  const setting = await prisma.appSetting.findUnique({ where: { key: STAFF_CODE_KEY } });
  return !!setting && verifyPassword(digits, setting.value);
}
