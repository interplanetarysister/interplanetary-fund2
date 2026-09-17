import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/pages/Connections.jsx", import.meta.url), "utf8");

assert.match(source, /const isRecord = \(value\) =>/);
assert.match(source, /const isConnectionList = \(value\) => Array\.isArray\(value\)/);
assert.match(source, /const readData = \(response\) =>/);
assert.match(source, /const readConnections = \(response\) =>/);
assert.match(source, /const readSyncResult = \(response\) =>/);
assert.match(source, /const requestGeneration = useRef\(0\)/);
assert.match(source, /const syncInFlight = useRef\(false\)/);
assert.match(source, /if \(syncInFlight\.current \|\| !mountedRef\.current\) return/);
assert.match(source, /const generation = \+\+requestGeneration\.current/);
assert.match(source, /const refreshGeneration = \+\+requestGeneration\.current/);
assert.match(source, /if \(!isCurrent\(refreshGeneration\)\) return/);
assert.match(source, /setConnections\(null\)/);
assert.match(source, /finally \{/);
assert.match(source, /SAFE_MALFORMED_SYNC/);
assert.match(source, /SAFE_MALFORMED_CONNECTIONS/);
assert.doesNotMatch(source, /e\.message|error\.message|response\?\.data|data\.error/);
assert.doesNotMatch(source, /console\.|analytics|telemetry|providerLog/);

const hostile = new Proxy(Object.create(null), {
  get() {
    throw new Error("sensitive provider payload");
  },
  getOwnPropertyDescriptor() {
    throw new Error("sensitive descriptor");
  },
});
assert.throws(() => hostile.data, /sensitive provider payload/);
assert.throws(() => Object.getOwnPropertyDescriptor(hostile, "data"), /sensitive descriptor/);

const sink = [];
const bounded = { error: "We couldn't sync your linked platforms. Please try again." };
sink.push(JSON.stringify(bounded));
assert.doesNotMatch(sink[0], /sensitive provider payload|stack|token|secret/i);

console.log("connections runtime contract passed");
