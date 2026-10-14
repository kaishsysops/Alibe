import { scanMessage } from "./safety.js";
const none = { hasOrder: false, unsentHandoverCode: null };
const cases: Array<[string, any, string | null]> = [
  ["Please pay first then I will send it", none, "PAY_FIRST"],
  ["send me 50% upfront to hold it", none, "PAY_FIRST"],
  ["I need a deposit to reserve it", none, "PAY_FIRST"],
  ["Can you transfer before I post it?", none, "PAY_FIRST"],
  ["I accept gift cards or USDT", none, "GIFT_CARD_CRYPTO"],
  ["pay via binance", none, "GIFT_CARD_CRYPTO"],
  ["check this https://bml-secure-pay.xyz/login", none, "LINK"],
  ["account no: 7730000123456", none, "BANK_DETAILS"],
  ["7730 0001 2345 6", none, "BANK_DETAILS"],
  ["My BML is 7730000123456", { hasOrder: true, unsentHandoverCode: null }, null],
  ["my code is 1180", { hasOrder: true, unsentHandoverCode: "1180" }, "HANDOVER_CODE"],
  // everyday messages that must NOT be flagged
  ["Is it still available?", none, null],
  ["Call me on 7771234", none, null],
  ["I'll pay when I collect it", none, null],
  ["First time buying here, can I see it today?", none, null],
  ["Price is 1500 final", none, null],
  ["I can pay cash at the jetty", none, null],
  ["It has 256GB and the battery is 89%", none, null],
];
let fail = 0;
for (const [text, ctx, want] of cases) {
  const got = scanMessage(text, ctx);
  const ok = got === want;
  if (!ok) fail++;
  console.log(ok ? "ok  " : "FAIL", JSON.stringify(text), "->", got, ok ? "" : `(wanted ${want})`);
}
console.log(fail ? `${fail} failed` : "all passed");
