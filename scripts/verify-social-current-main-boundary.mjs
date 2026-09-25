import fs from "node:fs";

const source = fs.readFileSync("src/pages/Social.jsx", "utf8");
const failures = [];

const required = [
  ["Social page exists", source.includes("export default function Social")],
  ["safe error state exists", source.includes("setError")],
  ["load path exists", source.includes("base44.auth.me")],
  ["admin capability remains explicitly review-gated", source.includes("user?.role === \"admin\"")],
];

for (const [label, ok] of required) if (!ok) failures.push(label);

const forbidden = [
  ["connection failure masking", /PlatformConnection\.filter\(\{\}\)\.catch\(\(\) => \[\]\)/],
  ["campaign failure masking", /Campaign\.filter\(\{\}\)\.catch\(\(\) => \[\]\)/],
  ["raw caught-message propagation", /catch\s*\([^)]*\)\s*\{[^}]*\.message/],
];

for (const [label, pattern] of forbidden) if (pattern.test(source)) failures.push(`forbidden pattern present: ${label}`);

if (failures.length) {
  console.error("Social current-main boundary verifier failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Social current-main boundary verifier passed");
