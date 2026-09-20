import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/NotificationBell.jsx", import.meta.url), "utf8");

const requiredTokens = [
  "function readSafeProperty",
  "authGenerationRef",
  "requestGenerationRef",
  "subscriptionGeneration",
  "aria-live=\"polite\"",
  "aria-describedby={error ? \"notification-bell-status\" : undefined}",
  "to=\"/notifications\"",
  "typeof unsubscribe === \"function\"",
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
]) {
  if (source.includes(forbidden)) {
    throw new Error(`NotificationBell runtime contract regression: ${forbidden}`);
  }
}

console.log("NotificationBell runtime contract passed");
