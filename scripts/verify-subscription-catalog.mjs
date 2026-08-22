import assert from "node:assert/strict";
import fs from "node:fs/promises";

const plansText = await fs.readFile(new URL("../src/components/subscriptions/plans.js", import.meta.url), "utf8");
const catalogText = await fs.readFile(new URL("../base44/shared/subscriptionCatalog.ts", import.meta.url), "utf8");

// Every Stripe price exposed as purchasable by the subscription UI must be
// present in the server-owned catalog. Empty IDs remain intentionally
// unavailable/Coming Soon and therefore are not treated as production prices.
const uiPriceIds = [...plansText.matchAll(/stripe_price_id:\s*"([^"]*)"/g)]
  .map((match) => match[1])
  .filter(Boolean);
const serverPriceIds = [...catalogText.matchAll(/'(price_[A-Za-z0-9]+)'/g)].map((match) => match[1]);

assert.ok(uiPriceIds.length > 0, "No purchasable subscription prices found in the UI catalog");
assert.equal(new Set(uiPriceIds).size, uiPriceIds.length, "Duplicate Stripe price IDs found in the UI catalog");
assert.equal(new Set(serverPriceIds).size, serverPriceIds.length, "Duplicate Stripe price IDs found in the server catalog");

for (const priceId of uiPriceIds) {
  assert.ok(serverPriceIds.includes(priceId), `UI subscription price is missing from server catalog: ${priceId}`);
}

for (const priceId of serverPriceIds) {
  assert.ok(uiPriceIds.includes(priceId), `Server subscription price is not exposed by the UI catalog: ${priceId}`);
}

console.log(`Subscription catalog verification passed: ${uiPriceIds.length} purchasable prices aligned.`);
