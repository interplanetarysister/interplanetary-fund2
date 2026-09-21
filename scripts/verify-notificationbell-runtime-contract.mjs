import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = fs.readFileSync(path.join(root, "src/components/NotificationBell.jsx"), "utf8");

const required = [
  ["mounted lifecycle fence", /mountedRef/],
  ["request-generation fence", /requestGenerationRef/],
  ["auth-generation fence", /authGenerationRef/],
  ["safe property access", /readSafeProperty/],
  ["bounded normalization", /MAX_NOTIFICATIONS\s*=\s*20/],
  ["dedicated notifications route", /to=\"\/notifications\"/],
  ["stable safe error", /SAFE_NOTIFICATION_ERROR/],
  ["accessible status", /role=\"status\"/],
  ["subscription cleanup guard", /typeof unsubscribe === \"function\"/],
];

for (const [label, pattern] of required) {
  if (!pattern.test(source)) {
    throw new Error(`NotificationBell runtime contract missing: ${label}`);
  }
}

const forbidden = [
  ["generic inbox route", /to=\"\/inbox\"/],
  ["raw empty catch", /catch\s*\(\)\s*=>\s*\{?\s*\}?/],
  ["unguarded direct async state commit", /\.then\(\(me\)\s*=>\s*\{\s*setUserId\(me\.id\)/],
];

for (const [label, pattern] of forbidden) {
  if (pattern.test(source)) {
    throw new Error(`NotificationBell runtime contract regression: ${label}`);
  }
}

console.log("NotificationBell runtime contract passed");
