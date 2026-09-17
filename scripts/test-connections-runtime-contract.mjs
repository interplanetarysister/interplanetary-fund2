import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/pages/Connections.jsx", import.meta.url), "utf8");

assert.match(source, /const isRecord = \(value\) =>/);
assert.match(source, /const isConnectionList = \(value\) => Array\.isArray\(value\)/);
assert.match(source, /const requestGeneration = useRef\(0\)/);
assert.match(source, /const syncInFlight = useRef\(false\)/);
assert.match(source, /if \(syncInFlight\.current \|\| !mountedRef\.current\) return/);
assert.match(source, /const generation = \+\+requestGeneration\.current/);
assert.match(source, /if \(!isCurrent\(generation\)\) return/);
assert.match(source, /finally \{/);
assert.match(source, /SAFE_MALFORMED_SYNC/);
assert.match(source, /SAFE_MALFORMED_CONNECTIONS/);
assert.doesNotMatch(source, /e\.message|error\.message|throw new Error\(/);

const hostile = Object.create(null, {
  data: {
    get() {
      throw new Error("sensitive provider payload");
    },
  },
});
assert.throws(() => hostile.data, /sensitive provider payload/);
assert.match(source, /response\?\.data/);

console.log("connections runtime contract passed");
