import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve("src/components/NotificationBell.jsx"), "utf8");

const required = [
  'to="/notifications"',
  'aria-label={`Notifications',
  'aria-describedby={error ? "notification-bell-status" : undefined}',
  'id="notification-bell-status"',
  'role="status"',
  'aria-live="polite"',
  'SAFE_NOTIFICATION_ERROR',
  'readSafeProperty(notification, "read") !== true',
];

const forbidden = [
  'to="/inbox"',
  'Inbox',
  'e.message',
  'String(e)',
  'String(error)',
  'setError(error',
  'setError(e',
];

const missing = required.filter((token) => !source.includes(token));
const presentForbidden = forbidden.filter((token) => source.includes(token));

if (missing.length || presentForbidden.length) {
  console.error(JSON.stringify({ missing, presentForbidden }, null, 2));
  process.exit(1);
}

console.log("NotificationBell accessibility and unread-policy contract verified.");
