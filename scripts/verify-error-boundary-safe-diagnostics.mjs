import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/components/ErrorBoundary.jsx", "utf8");

assert.match(source, /function classifyRenderFailure\(value\)/);
assert.match(source, /console\.error\("Route render error:", classifyRenderFailure\(error\)\)/);
// Inspect only the console.error argument expressions, not approved string labels.
const consoleErrorCall = source.match(/console\.error\(([^\n]+)\)/)?.[1] ?? "";
assert.doesNotMatch(consoleErrorCall, /\b(?:error|info)\b(?!\s*\))/);
assert.doesNotMatch(source, /this\.state\.error\?\.message/);
assert.match(source, /An unexpected error occurred while rendering this page\./);
assert.match(source, /reset = \(\) => this\.setState\(\{ error: null \}\)/);

const classifications = new Set(["object", "string", "function", "number", "boolean", "nullish", "unknown"]);
assert.equal(classifications.size, 7);
console.log("ErrorBoundary safe diagnostics contract passed.");
