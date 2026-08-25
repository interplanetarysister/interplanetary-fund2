import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/components/onboarding/onboardingSteps.js", import.meta.url), "utf8");
const expectedNotConfigured = ["facebook_pages", "instagram", "tiktok", "linkedin", "paypal"];
for (const id of expectedNotConfigured) {
  const match = source.match(new RegExp(`id: "${id}"[\\s\\S]{0,180}?status: "([^"]+)"`));
  assert.ok(match, `missing onboarding capability ${id}`);
  assert.equal(match[1], "setup_required", `${id} must not claim an active integration before configuration exists`);
}
assert.match(source, /status: "connected"/);
assert.match(source, /status: "coming_soon"/);
console.log("onboarding capability status verification passed");
