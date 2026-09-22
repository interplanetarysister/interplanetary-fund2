import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = process.env.NOTIFICATIONBELL_SOURCE_PATH
  ? path.resolve(root, process.env.NOTIFICATIONBELL_SOURCE_PATH)
  : path.join(root, "src/components/NotificationBell.jsx");
const source = fs.readFileSync(sourcePath, "utf8");

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
  ["null read compatibility", /read === undefined \|\| read === null \|\| typeof read === \"boolean\"/],
];

for (const [label, pattern] of required) {
  if (!pattern.test(source)) {
    throw new Error(`NotificationBell runtime contract missing: ${label}`);
  }
}

console.log("NotificationBell runtime contract passed");
