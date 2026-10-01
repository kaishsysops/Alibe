// Maldivian numbers are 7 digits; anything without a country code is assumed local.
export function internationalDigits(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 7 ? `960${digits}` : digits;
}

export function formatPhone(raw: string | null | undefined) {
  if (!raw) return "";
  const digits = internationalDigits(raw);
  if (digits.startsWith("960") && digits.length === 10) return `+960 ${digits.slice(3, 6)} ${digits.slice(6)}`;
  return raw.startsWith("+") ? raw : `+${digits}`;
}

export const whatsappUrl = (number: string, text?: string) =>
  `https://wa.me/${internationalDigits(number)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export const viberUrl = (number: string) => `viber://chat?number=%2B${internationalDigits(number)}`;

export const telUrl = (number: string) => `tel:+${internationalDigits(number)}`;
