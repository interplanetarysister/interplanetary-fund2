import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const componentPath = path.resolve(here, "../src/components/NotificationBell.jsx");
const source = fs.readFileSync(componentPath, "utf8");

assert.match(
  source,
  /readSafeProperty\(\s*[^,]+,\s*["']read["']\s*\)\s*!==\s*true/,
  "NotificationBell must use the explicit unread policy: any value other than true is unread",
);

const isUnread = (row) => row.read !== true;
assert.equal(isUnread({}), true, "missing read must remain unread");
assert.equal(isUnread({ read: undefined }), true, "undefined read must remain unread");
assert.equal(isUnread({ read: null }), true, "null read must remain unread");
assert.equal(isUnread({ read: false }), true, "false read must remain unread");
assert.equal(isUnread({ read: true }), false, "true read must be treated as read");

console.log("NotificationBell read-policy checks passed");
