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

const throwingIdRow = new Proxy({ read: false }, {
  get(target, property) {
    if (property === "id") throw new Error("hostile id getter");
    return target[property];
  },
});
assert.equal(isSafeNotificationRow(throwingIdRow), false);

const thenablePayload = {
  then() {
    throw new Error("thenable payload must never be awaited by normalization");
  },
};
assert.deepEqual(normalizeNotifications(thenablePayload), null);
assert.deepEqual(normalizeNotifications({ not: "an array" }), null);

const thenableRow = new Proxy({ id: "thenable-row", read: false }, {
  get(target, property) {
    if (property === "then") throw new Error("thenable row must never be awaited by normalization");
    return target[property];
  },
});
const normalizedThenableRow = normalizeNotifications([thenableRow]);
assert.equal(normalizedThenableRow.length, 1);
assert.equal(normalizedThenableRow[0].id, "thenable-row");

const oversizedId = "x".repeat(161);
assert.equal(isSafeNotificationRow({ id: oversizedId, read: false }), false);
assert.equal(isSafeNotificationRow({ id: "ok", read: "false" }), false);
assert.equal(isSafeNotificationRow({ id: "ok", read: undefined }), true);

const rows = Array.from({ length: 25 }, (_, index) => ({ id: `id-${index}`, read: index % 2 === 0 }));
const bounded = normalizeNotifications(rows);
assert.equal(bounded.length, 20);
assert.equal(bounded[0].id, "id-0");
assert.equal(bounded.at(-1).id, "id-19");

const duplicateIds = Array.from(
  normalizeNotifications([
    { id: "a", read: false },
    { id: "a", read: true },
    { id: "b", read: true },
    null,
    { id: "", read: false },
  ]),
  (row) => row.id,
);
assert.deepEqual(duplicateIds, ["a", "b"]);

console.log("NotificationBell behavior contract passed");
