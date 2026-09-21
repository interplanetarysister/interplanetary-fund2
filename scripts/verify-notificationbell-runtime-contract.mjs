import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/NotificationBell.jsx", import.meta.url), "utf8");

const requiredTokens = [
  "function readSafeProperty",
  "function normalizeNotifications",
  "if (!Array.isArray(value)) return null",
  "authGenerationRef",
  "requestGenerationRef",
  "subscriptionGeneration",
  "aria-live=\"polite\"",
  "aria-describedby={error ? \"notification-bell-status\" : undefined}",
  "to=\"/notifications\"",
  "typeof unsubscribe === \"function\"",
  "readSafeProperty(notification, \"read\") !== true",
];

for (const token of requiredTokens) {
  if (!source.includes(token)) {
    throw new Error(`NotificationBell runtime contract missing: ${token}`);
  }
}

for (const forbidden of [
  "title={error || undefined}",
  ".catch(() => setNotifications([]))",
  "console.error(\"Notification load failed\",",
  "to=\"/inbox\"",
  "await Promise.resolve(value)",
  "read === true || read === false || read === undefined",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`NotificationBell runtime contract regression: ${forbidden}`);
  }
}

const normalizeStart = source.indexOf("function normalizeNotifications");
const componentStart = source.indexOf("export default function NotificationBell");
if (normalizeStart < 0 || componentStart < 0 || normalizeStart >= componentStart) {
  throw new Error("NotificationBell runtime contract could not locate normalization boundary");
}

const normalizeSource = source.slice(normalizeStart, componentStart);
if (!normalizeSource.includes("if (!Array.isArray(value)) return null")) {
  throw new Error("NotificationBell malformed-response policy must fail closed before row iteration");
}
if (!normalizeSource.includes("if (bounded.length >= MAX_NOTIFICATIONS) break")) {
  throw new Error("NotificationBell normalization must preserve the bounded payload policy");
}

console.log("NotificationBell runtime contract passed");
