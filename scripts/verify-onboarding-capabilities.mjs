import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/components/onboarding/onboardingSteps.js", import.meta.url), "utf8");
const connectStep = fs.readFileSync(new URL("../src/components/onboarding/ConnectStep.jsx", import.meta.url), "utf8");

const expectedSetupRequired = ["facebook_pages", "instagram", "tiktok", "linkedin", "paypal", "stripe"];
const expectedComingSoon = ["gofundme", "kickstarter", "indiegogo"];

function capabilityEntry(id) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`\\{\\s*id: "${escapedId}",\\s*label: "[^"]+",\\s*status: "([^"]+)"\\s*\\}`));
  assert.ok(match, `missing onboarding capability entry ${id}`);
  return match[1];
}

for (const id of expectedSetupRequired) {
  assert.equal(capabilityEntry(id), "setup_required", `${id} must not claim a connected workspace before authoritative configuration exists`);
}

for (const id of expectedComingSoon) {
  assert.equal(capabilityEntry(id), "coming_soon", `${id} must remain explicitly unsupported/not-yet-available`);
}

assert.match(connectStep, /const me = await base44\.auth\.me\(\);/);
assert.match(connectStep, /PlatformConnection\.filter\(\{[\s\S]*created_by_id: me\.id,[\s\S]*status: "connected"[\s\S]*\}\)/);
assert.doesNotMatch(connectStep, /PlatformConnection\.filter\(\{ status: "connected" \}\)/);
assert.match(connectStep, /facebook_pages/);
assert.match(connectStep, /instagram/);
assert.match(connectStep, /tiktok/);
assert.match(connectStep, /linkedin/);
assert.match(connectStep, /stripe/);
assert.match(connectStep, /paypal/);
assert.match(connectStep, /const effectiveStatus = connectedIds\.has\(item\.id\) \? "connected" : item\.status/);
assert.match(connectStep, /disabled=\{disabled\}/);
assert.match(connectStep, /aria-pressed=\{isSelected\}/);
assert.match(connectStep, /role="status"/);
assert.match(connectStep, /Connections Center/);
assert.match(connectStep, /selected\.filter\(\(id\) => connectedIds\.has\(id\)\)/);

console.log("onboarding capability source-of-truth contract passed");
