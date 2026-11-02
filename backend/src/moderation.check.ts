import { prohibitedReason } from "./moderation.js";
const cases: Array<[string, string | null]> = [
  ["Bottle of red wine", "alcohol"],
  ["Imported whisky 750ml", "alcohol"],
  ["Cold beer for sale", "alcohol"],
  ["Crystal wine glasses set of 6", null],
  ["Wine fridge, 12 bottles", null],
  ["Beer mug", null],
  ["Fresh pork ribs", "pork"],
  ["Pig plush toy", null],
  ["9mm pistol", "weapons"],
  ["Glue gun", null],
  ["Massage gun", null],
  ["Knife set for the kitchen", null],
  ["Rolex first copy", "counterfeit goods"],
  ["Fake passport", "counterfeit goods"],
  ["Cannabis seeds", "drugs"],
  ["iPhone 13 Pro 256GB", null],
  ["Sofa, grey, good condition", null],
];
let fail = 0;
for (const [text, want] of cases) {
  const got = prohibitedReason(text);
  const ok = got === want;
  if (!ok) fail++;
  console.log(ok ? "ok  " : "FAIL", JSON.stringify(text), "->", got, ok ? "" : `(wanted ${want})`);
}
console.log(fail ? `${fail} failed` : "all passed");
