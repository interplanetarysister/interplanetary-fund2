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

assert.match(connectStep, /base44\.entities\.PlatformConnection\.filter\(\{ status: "connected" \}\)/);
assert.match(connectStep, /CONNECTION_ID_BY_PLATFORM/);
assert.match(connectStep, /facebook_pages/);
assert.match(connectStep, /instagram/);
assert.match(connectStep, /tiktok/);
assert.match(connectStep, /linkedin/);
assert.match(connectStep, /const effectiveStatus = connectedIds\.has\(item\.id\) \? "connected" : item\.status/);
assert.match(connectStep, /disabled=\{disabled\}/);
assert.match(connectStep, /aria-pressed=\{isSelected\}/);
assert.match(connectStep, /status: "setup_required"/);
assert.doesNotMatch(connectStep, /gofundme:\s*"gofundme"/);
assert.doesNotMatch(connectStep, /stripe:\s*"stripe"/);

console.log("onboarding capability source-of-truth contract passed");
