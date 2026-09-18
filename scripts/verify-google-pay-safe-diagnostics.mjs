import fs from "node:fs";

const source = fs.readFileSync("src/components/payments/GooglePayButton.jsx", "utf8");
const required = [
  ["stable payment error", source.includes("SAFE_PAYMENT_ERROR")],
  ["no raw thrown message access", !source.includes("err.message") && !source.includes("e.message")],
  ["config validation", source.includes("isValidConfig")],
  ["order validation", source.includes("isValidOrder")],
  ["capture validation", source.includes("isSuccessfulCapture")],
  ["ambiguous capture fails closed", source.includes("!isSuccessfulCapture(cap)")],
  ["success callback remains gated", source.includes("p.onPaid?.(cap)")],
];

const failed = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error(`Google Pay verifier failed: ${failed.join(", ")}`);
  process.exit(1);
}
console.log(`Google Pay verifier passed ${required.length} checks.`);
