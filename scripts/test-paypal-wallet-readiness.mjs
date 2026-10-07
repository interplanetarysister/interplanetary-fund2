import assert from "node:assert/strict";
import { resolvePayPalCaptureAllocation } from "../base44/shared/paypalAllocation.js";
import { readFileSync } from "node:fs";
import {
  computePayPalBreakdown,
  computePayPalProcessingFee,
  computePayPalWalletProcessingFee,
  MIN_DONATION,
} from "../src/lib/fees.js";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const create = read("base44/functions/createPayPalOrder/entry.ts");
const paypal = read("base44/functions/getPayPalConfig/entry.ts");
const capabilities = read("base44/functions/getPaymentCapabilities/entry.ts");
const sdk = read("src/components/payments/paypalScripts.js");
const wallet = read("src/components/payments/GooglePayButton.jsx");

for (const channel of ["paypal", "googlepay"]) {
  for (const optIn of [true, false]) {
    for (const charged of [2, 25, 50, 100, 250]) {
      const b = computePayPalBreakdown(charged, optIn, channel);
      const expected = channel === "googlepay"
        ? computePayPalWalletProcessingFee(charged)
        : computePayPalProcessingFee(charged);
      assert.equal(b.totalCharged, charged);
      assert.equal(b.processing, expected);
      assert.equal(Math.round((b.amount + b.processing) * 100), Math.round(charged * 100));
      assert.equal(Math.round((b.recipientGift + b.contribution) * 100), Math.round(b.amount * 100));
      assert.equal(Math.round((b.recipientNet + b.platformFee) * 100), Math.round(b.recipientGift * 100));
      assert.ok(b.amount >= MIN_DONATION);
    }
  }
}
const example = computePayPalBreakdown(25, false, "paypal");
assert.equal(example.processing, 1.32);
assert.equal(example.amount, 23.68);
assert.equal(example.recipientGift, 23.68);
assert.equal(example.platformFee, 0.71);
assert.equal(example.recipientNet, 22.97);

const actualPayPal = resolvePayPalCaptureAllocation({
  chargedAmount: 25, quotedDonation: 23.68, quotedFee: 1.32,
  quotedContribution: 0, providerReceivable: 23.64, providerFee: 1.36,
});
assert.equal(actualPayPal.ok, true);
assert.equal(actualPayPal.amount, 23.64);
assert.equal(actualPayPal.processingFee, 1.36);
assert.equal(actualPayPal.platformContribution, 0);
assert.equal(actualPayPal.source, "paypal_receivable");

const actualWithContribution = resolvePayPalCaptureAllocation({
  chargedAmount: 25, quotedDonation: 23.68, quotedFee: 1.32,
  quotedContribution: 2.37, providerReceivable: 23.64, providerFee: 1.36,
});
assert.equal(actualWithContribution.platformContribution, 2.36);

const noBreakdown = resolvePayPalCaptureAllocation({
  chargedAmount: 25, quotedDonation: 23.68, quotedFee: 1.32, quotedContribution: 0,
});
assert.equal(noBreakdown.ok, true);
assert.equal(noBreakdown.amount, 23.68);
assert.equal(noBreakdown.source, "quote");

const invalidCharge = resolvePayPalCaptureAllocation({
  chargedAmount: 50, quotedDonation: 23.68, quotedFee: 1.32, quotedContribution: 0,
});
assert.equal(invalidCharge.ok, false);
assert.equal(invalidCharge.reason, "order_mismatch");

const tooSmall = resolvePayPalCaptureAllocation({
  chargedAmount: 1, quotedDonation: .70, quotedFee: .30, quotedContribution: 0,
});
assert.equal(tooSmall.ok, false);
assert.equal(tooSmall.reason, "amount_below_minimum");

assert.match(create, /validateDonationAmount\(value\)/);
assert.match(paypal, /isLivePayPalRestReady\(\)/);
assert.match(capabilities, /isLivePayPalRestReady\(\)/);
assert.match(sdk, /components=buttons,googlepay&/);
assert.match(sdk, /window\.paypal\?\.Buttons/);
assert.match(wallet, /paypal\.Googlepay\(\)/);
assert.match(wallet, /result\?\.ok !== true/);
const capture = read("base44/functions/capturePayPalOrder/entry.ts");
assert.match(capture, /resolvePayPalCaptureAllocation/);
assert.match(capture, /savedOperation\.gross_amount/);
console.log("PayPal/Google Pay fee, readiness, and SDK contracts verified.");
