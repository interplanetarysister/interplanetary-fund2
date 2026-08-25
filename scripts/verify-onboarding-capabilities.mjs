import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/components/onboarding/onboardingSteps.js", import.meta.url), "utf8");
const expectedSetupRequired = ["facebook_pages", "instagram", "tiktok", "linkedin", "paypal"];
const expectedConnected = ["stripe"];
const expectedComingSoon = ["gofundme", "kickstarter", "indiegogo"];

function capabilityEntry(id) {
  const escapedId = id.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`\\{\\s*id: "${escapedId}",\\s*label: "[^"]+",\\s*status: "([^"]+)"\\s*\\}`));
  assert.ok(match, `missing onboarding capability entry ${id}`);
  return match[1];
}

for (const id of expectedSetupRequired) {
  assert.equal(capabilityEntry(id), "setup_required", `${id} must not claim an active integration before workspace configuration exists`);
}
for (const id of expectedConnected) {
  assert.equal(capabilityEntry(id), "connected", `${id} must remain represented as connected`);
}
for (const id of expectedComingSoon) {
  assert.equal(capabilityEntry(id), "coming_soon", `${id} must remain explicitly unsupported/not-yet-available`);
}

const connectStep = fs.readFileSync(new URL("../src/components/onboarding/ConnectStep.jsx", import.meta.url), "utf8");
assert.match(connectStep, /const disabled = item\.status !== "connected"/);
assert.match(connectStep, /disabled=\{disabled\}/);
assert.match(connectStep, /status: "setup_required"/);

console.log("onboarding capability readiness contract passed");
