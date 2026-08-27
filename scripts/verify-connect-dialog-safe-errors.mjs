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

const diagnosticIndex = source.indexOf('console.error("ConnectDialog connection save failed:", e)');
const safeMessageIndex = source.indexOf('setError("Couldn\'t save this connection. Please try again. If the problem continues, contact support.")');
assert.ok(diagnosticIndex >= 0 && safeMessageIndex > diagnosticIndex, 'controlled diagnostics must be recorded before the safe client message');

console.log("ConnectDialog safe-error contract passed");
