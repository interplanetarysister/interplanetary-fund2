import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/NotificationBell.jsx", import.meta.url), "utf8");

const requiredTokens = [
  "SAFE_NOTIFICATION_ERROR",
  "normalizeNotifications",
  "mountedRef",
  "requestGenerationRef",
  "to=\"/notifications\"",
  "aria-label={`Notifications",
  "typeof unsubscribe === \"function\"",
];

for (const token of requiredTokens) {
  if (!source.includes(token)) {
    throw new Error(`NotificationBell contract missing: ${token}`);
  }
}

for (const forbidden of [
  "to=\"/inbox\"",
  ".catch(() => setNotifications([]))",
  "console.error(\"Notification load failed\",",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`NotificationBell contract regression: ${forbidden}`);
  }
}

console.log("NotificationBell safe-loading contract passed");
