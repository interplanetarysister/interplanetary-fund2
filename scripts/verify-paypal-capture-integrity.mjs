import assert from "node:assert/strict";
import fs from "node:fs/promises";

const capture = await fs.readFile(new URL("../base44/functions/capturePayPalOrder/entry.ts", import.meta.url), "utf8");
const paypal = await fs.readFile(new URL("../base44/shared/paypal.ts", import.meta.url), "utf8");
const schema = await fs.readFile(new URL("../base44/entities/Donation.jsonc", import.meta.url), "utf8");

assert.match(capture, /Donation\.filter\(\{\s*stripe_session_id:\s*orderId\s*\}\)/,
  "PayPal capture must reconcile a repeated provider order before creating another donation");
assert.match(capture, /prior\.campaign_id\s*!==\s*requestedCampaignId/,
  "A repeated provider order must not be accepted for a different campaign");
assert.match(capture, /cap\.campaign_id\s*!==\s*requestedCampaignId/,
  "The provider order campaign identity must be authoritative over the client request");
assert.match(capture, /Number\.isFinite\(cap\.amount\)\s*\|\|\s*cap\.amount\s*<=\s*0/,
  "The captured amount must be finite and positive before ledger mutation");
assert.match(capture, /is_recurring:\s*false/,
  "Google Pay/PayPal order capture must not accept a client-controlled recurring flag");
assert.match(capture, /stripe_session_id:\s*orderId/,
  "The provider order ID must be persisted as the external payment reference");
assert.match(capture, /Unable to finalize the payment at this time/,
  "Unexpected provider/backend errors must not be disclosed to clients");
assert.match(paypal, /campaign_id:\s*purchaseUnit\?\.custom_id/,
  "PayPal capture must return the provider-supplied campaign identity");
assert.match(paypal, /encodeURIComponent\(orderId\)/,
  "PayPal order IDs must be safely encoded in provider URLs");
assert.match(schema, /"stripe_session_id"/,
  "Donation must retain the external provider reference field used for retry reconciliation");

console.log("PayPal capture integrity verification passed: provider campaign binding, positive amount validation, sequential retry reconciliation, recurring-flag isolation, safe error disclosure, and external-reference preservation are enforced.");
console.log("Concurrent duplicate creation remains a backend uniqueness/idempotency requirement and is not falsely claimed complete by this focused patch.");
