import fs from "node:fs";

const source = fs.readFileSync("src/pages/Discover.jsx", "utf8");

const required = [
  ['stable safe error copy', 'SAFE_DISCOVER_ERROR'],
  ['array response validation', 'Array.isArray(result)'],
  ['mounted fencing', 'mountedRef.current'],
  ['request generation fencing', 'requestRef.current === requestId'],
  ['raw message removed', '!e.message'],
];

for (const [label, token] of required) {
  if (!source.includes(token)) {
    throw new Error(`Discover safe-loading contract missing: ${label}`);
  }
}

if (/catch\\s*\\(e\\)[\\s\\S]{0,180}e\\.message/.test(source)) {
  throw new Error("Discover still exposes raw caught exception text");
}

console.log("Discover safe-loading contract passed");
