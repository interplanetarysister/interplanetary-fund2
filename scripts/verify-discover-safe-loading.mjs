import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/pages/Discover.jsx", "utf8");

assert.match(source, /SAFE_DISCOVER_ERROR/);
assert.match(source, /normalizeCampaignRows/);
assert.match(source, /Array\.isArray\(value\)/);
assert.match(source, /MAX_CAMPAIGNS/);
assert.match(source, /requestGeneration/);
assert.match(source, /mounted = true/);
assert.match(source, /generation !== requestGeneration\.current/);
assert.doesNotMatch(source, /e\.message/);
assert.doesNotMatch(source, /err\.message/);
assert.doesNotMatch(source, /String\(e\)/);
assert.doesNotMatch(source, /String\(err\)/);
assert.match(source, /status !== "active"/);
assert.match(source, /ids\.has\(row\.id\)/);

console.log("Discover safe-loading contract passed");
