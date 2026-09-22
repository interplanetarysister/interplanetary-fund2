import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = path.join(root, "base44/entities/Notification.jsonc");
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));

assert.equal(schema.properties.user_id.type, "string");
assert.equal(schema.properties.read.type, "boolean");
assert.equal(schema.properties.read.default, false);
assert.deepEqual(schema.required, ["user_id", "title"]);

for (const operation of ["read", "create", "update", "delete"]) {
  const rules = schema.rls?.[operation]?.$or ?? [];
  assert.ok(rules.some((rule) => rule["data.user_id"] === "{{user.id}}"), `${operation} must be owner-scoped`);
  assert.ok(
    rules.some((rule) => rule.user_condition?.role === "admin"),
    `${operation} must preserve admin override`,
  );
}

const isUnread = (value) => value !== true;
assert.equal(isUnread(undefined), true);
assert.equal(isUnread(null), true);
assert.equal(isUnread(false), true);
assert.equal(isUnread(true), false);

console.log("Notification ownership and unread-policy contract passed");
