import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const source = fs.readFileSync("src/components/NotificationBell.jsx", "utf8");
const helperMatch = source.match(/const MAX_NOTIFICATIONS = (\d+);[\s\S]*?function normalizeNotifications\(value\) \{[\s\S]*?\n\}/);
assert.ok(helperMatch, "NotificationBell helper contract is present");

const helperSource = `${helperMatch[0]}\nmodule.exports = { readSafeProperty, isSafeNotificationRow, normalizeNotifications };`;
const sandbox = { module: { exports: {} }, exports: {}, require };
vm.runInNewContext(`(function (module, exports, require) {${helperSource}\n})(module, exports, require);`, sandbox, {
  filename: "NotificationBell.jsx",
});

const { readSafeProperty, isSafeNotificationRow, normalizeNotifications } = sandbox.module.exports;

const throwingRow = new Proxy({ id: "throwing", read: false }, {
  get(target, property) {
    if (property === "read") throw new Error("hostile getter");
    return target[property];
  },
});

assert.equal(readSafeProperty(throwingRow, "read"), undefined);
assert.equal(isSafeNotificationRow(throwingRow), false);
assert.deepEqual(normalizeNotifications({ not: "an array" }), null);
assert.deepEqual(
  normalizeNotifications([
    { id: "a", read: false },
    { id: "a", read: true },
    { id: "b", read: true },
    null,
    { id: "", read: false },
  ]).map((row) => row.id),
  ["a", "b"],
);

console.log("NotificationBell behavior contract passed");
