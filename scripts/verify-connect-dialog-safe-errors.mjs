import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/components/connections/ConnectDialog.jsx", import.meta.url), "utf8");

assert.match(source, /setError\("Couldn't save this connection\. Please try again\. If the problem continues, contact support\."\)/);
assert.match(source, /console\.error\("ConnectDialog connection save failed:", e\)/);
assert.doesNotMatch(source, /setError\(e\.message/);
assert.doesNotMatch(source, /setError\(.*error\.message/);
assert.match(source, /PlatformConnection\.(update|create)/);
assert.match(source, /campaign_id/);
assert.match(source, /credentials/);

console.log("ConnectDialog safe-error contract passed");
