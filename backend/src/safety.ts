// Scam-pattern scanner for chat messages. Each sent message is checked once;
// a match is stored on the message as `flag` and the app shows the *other*
// person a plain-language warning under it. Nothing is blocked: false
// positives cost a little friction, missed scams cost someone their money.

export type MessageFlag = "PAY_FIRST" | "GIFT_CARD_CRYPTO" | "LINK" | "BANK_DETAILS" | "HANDOVER_CODE";

export type ScanContext = {
  // A live (not cancelled) order exists in this chat.
  hasOrder: boolean;
  // The sender's handover code, if they're the buyer of a live order that
  // hasn't been sent yet.
  unsentHandoverCode: string | null;
};

const PAY_FIRST = [
  /\b(pay|send|transfer)\b[^.!?\n]{0,25}\b(first|before|advance|upfront|up front)\b/i,
  /\b(advance|upfront|up-front)\s+(payment|pay|transfer)\b/i,
  /\b(deposit|booking fee|holding fee|reservation fee)\b/i,
  /\bpay\s+(half|50%)\b/i,
];
const GIFT_CARD_CRYPTO = [/\bgift\s?cards?\b/i, /\b(itunes|google play|steam)\s+(card|code|voucher)/i, /\b(usdt|bitcoin|btc|crypto|binance|ethereum)\b/i];
const LINK = [/\bhttps?:\/\/\S+/i, /\bwww\.\S+\.\S+/i, /\b(bit\.ly|tinyurl\.com|t\.me|wa\.me)\/\S+/i];
// Maldivian bank account numbers are 13+ digits (BML 77xxxxxxxxxxx); allow
// spaces/dashes between groups. Phone numbers (7 digits) don't match.
const BANK_DETAILS = [/\b\d(?:[\s-]?\d){11,17}\b/, /\b(account|acc|a\/c)\s*(no|number|#)?\s*[:.]?\s*\d{6,}/i, /\bIBAN\b/i];

export function scanMessage(text: string, ctx: ScanContext): MessageFlag | null {
  if (!text) return null;
  if (ctx.unsentHandoverCode && new RegExp(`\\b${ctx.unsentHandoverCode}\\b`).test(text)) return "HANDOVER_CODE";
  if (PAY_FIRST.some((r) => r.test(text))) return "PAY_FIRST";
  if (GIFT_CARD_CRYPTO.some((r) => r.test(text))) return "GIFT_CARD_CRYPTO";
  // Sharing bank details is normal once there's an order to pay for; before
  // that it's usually a push to pay for something not yet agreed.
  if (!ctx.hasOrder && BANK_DETAILS.some((r) => r.test(text))) return "BANK_DETAILS";
  if (LINK.some((r) => r.test(text))) return "LINK";
  return null;
}
