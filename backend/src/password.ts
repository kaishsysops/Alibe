import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt) as (password: string, salt: string, length: number) => Promise<Buffer>;
const KEY_LENGTH = 64;

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${(await scrypt(password, salt, KEY_LENGTH)).toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, key] = stored.split(":");
  return crypto.timingSafeEqual(await scrypt(password, salt, KEY_LENGTH), Buffer.from(key, "hex"));
}

// Checked when the username doesn't exist, so a wrong name takes as long as a
// wrong password and can't be used to discover who the staff are.
export const DECOY_HASH = `${"0".repeat(32)}:${"0".repeat(KEY_LENGTH * 2)}`;
