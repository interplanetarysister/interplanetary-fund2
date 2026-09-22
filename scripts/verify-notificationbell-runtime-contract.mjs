import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = process.env.NOTIFICATIONBELL_SOURCE_PATH
  ? path.resolve(root, process.env.NOTIFICATIONBELL_SOURCE_PATH)
  : path.join(root, "src/components/NotificationBell.jsx");
const source = fs.readFileSync(sourcePath, "utf8");

const forbidden = [
  ["generic inbox route", /\bto\s*=\s*["']\/inbox["']/],
  ["raw empty catch", /catch\s*(?:\(\s*\)\s*=>\s*\{\s*\}|\{\s*\})/],
  [
    "unguarded direct async state commit",
    /\.then\(\s*\(\s*me\s*\)\s*=>\s*\{\s*setUserId\(\s*me\.id\s*\)/,
  ],
];

for (const [label, pattern] of forbidden) {
  if (pattern.test(source)) {
    throw new Error(`NotificationBell runtime contract regression: ${label}`);
  }
}

const required = [
  ["mounted lifecycle fence", /\bmountedRef\b/],
  ["request-generation fence", /\brequestGenerationRef\b/],
  ["auth-generation fence", /\bauthGenerationRef\b/],
  ["safe property access", /\breadSafeProperty\b/],
  ["bounded normalization", /\bMAX_NOTIFICATIONS\s*=\s*20\b/],
  ["dedicated notifications route", /\bto\s*=\s*["']\/notifications["']/],
  ["stable safe error", /\bSAFE_NOTIFICATION_ERROR\b/],
  ["accessible status", /\brole\s*=\s*["']status["']/],
  [
    "subscription cleanup guard",
    /typeof\s+unsubscribe\s*===\s*["']function["']/,
  ],
];

for (const [label, pattern] of required) {
  if (!pattern.test(source)) {
    throw new Error(`NotificationBell runtime contract missing: ${label}`);
  }
}

const readPolicyPresent =
  source.includes('read === undefined') &&
  source.includes('read === null') &&
  source.includes('typeof read === "boolean"');
if (!readPolicyPresent) {
  throw new Error("NotificationBell runtime contract missing: null read compatibility");
}

console.log("NotificationBell runtime contract passed");
