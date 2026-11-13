import { prisma } from "./db.js";
import { deliveryMethods } from "./messaging.js";

// Things Alibe can't carry. Blocks at publish time, so the wording stays narrow:
// everyday items that only mention these words (wine glasses, a glue gun) pass.
// A false block stops an honest seller; anything missed can still be reported.
const PROHIBITED: Array<[RegExp, string]> = [
  [/\b(alcohol|whisk(y|ey)|vodka|tequila|liquor|beers?|wines?)\b(?!\s*(glass(es)?|fridge|cooler|rack|opener|mug|stein|bottle opener|free|cabinet|colou?r|red)\b)/i, "alcohol"],
  [/\b(pork|bacon)\b/i, "pork"],
  [/\b(cannabis|marijuana|heroin|cocaine|methamphetamine|mdma|ecstasy pills?)\b/i, "drugs"],
  [/\b(firearms?|pistols?|revolvers?|rifles?|shotguns?|ammunition|hand ?grenades?|explosives?)\b/i, "weapons"],
  [/\b(counterfeit|fake (designer|brand|id|passport)|first copy|master copy)\b/i, "counterfeit goods"],
];

export function prohibitedReason(text: string) {
  return PROHIBITED.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

// New accounts are where bulk scams come from, so their first week is capped
// well above what an honest new seller or buyer needs.
const NEW_ACCOUNT_MS = 7 * 86_400_000;
const DAY_MS = 86_400_000;
const NEW_ACCOUNT_LISTINGS_PER_DAY = 5;
const NEW_ACCOUNT_CHATS_PER_DAY = 20;

const isNewAccount = (createdAt: Date) => Date.now() - createdAt.getTime() < NEW_ACCOUNT_MS;
const today = () => ({ gte: new Date(Date.now() - DAY_MS) });

// Why this person can't publish a listing right now, or null if they can.
export async function listingBlock(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true, createdAt: true } });
  if (!user) return { status: 404, error: "Your account couldn't be found. Please sign in again." };
  // With phone sign-in on, a verified number is what makes a ban stick, so
  // sellers need one. Email-only for now: the verified email does that job.
  if (deliveryMethods().phone && !user.phone) return { status: 403, error: "Please add your phone number before you sell.", code: "PHONE_REQUIRED" };
  if (isNewAccount(user.createdAt) && (await prisma.listing.count({ where: { sellerId: userId, createdAt: today() } })) >= NEW_ACCOUNT_LISTINGS_PER_DAY) {
    return { status: 429, error: `New accounts can post ${NEW_ACCOUNT_LISTINGS_PER_DAY} items a day. Please post the rest tomorrow.` };
  }
  return null;
}

export async function chatLimitReached(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
  if (!user || !isNewAccount(user.createdAt)) return false;
  return (await prisma.conversation.count({ where: { buyerId: userId, createdAt: today() } })) >= NEW_ACCOUNT_CHATS_PER_DAY;
}

export const CLOSED_ACCOUNT_ERROR = "This account has been closed for breaking Alibe's rules.";

// A banned phone or email stays banned even after its account is gone.
export async function isBannedContact(value: string) {
  return !!(await prisma.bannedContact.findUnique({ where: { value } }));
}
