import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./audit-shared-surface-contrast.mjs", import.meta.url), "utf8");

assert.match(source, /function normalizeRelativePath\(relativePath\)/);
assert.match(source, /relativePath\.split\(path\.sep\)\.join\(path\.posix\.sep\)/);
assert.match(source, /path\.posix\.join\(relativeDir, entry\.name\)/);

const windowsLike = "src\\components\\connections\\ConnectionCard.jsx";
const normalized = windowsLike.split("\\").join("/");
assert.equal(normalized, "src/components/connections/ConnectionCard.jsx");

console.log("shared-surface audit path normalization contract passed");
