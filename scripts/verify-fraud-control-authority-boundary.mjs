import fs from "node:fs";

const source = fs.readFileSync("src/components/platform/FraudControlPanel.jsx", "utf8");

const required = [
  ["Fraud Control source exists", source.length > 0],
  ["no direct Withdrawal update", !/entities\.Withdrawal\.update\s*\(/.test(source)],
  ["no direct Campaign update", !/entities\.Campaign\.update\s*\(/.test(source)],
  ["no raw caught message access", !/\b(?:e|err|error)\.message\b/.test(source)],
  ["no raw caught object interpolation", !/\$\{\s*(?:e|err|error)\s*\}/.test(source)],
  ["privileged actions remain explicit", /approve|deny|freeze|unfreeze/i.test(source)],
];

const failed = required.filter(([, ok]) => !ok);
for (const [label, ok] of required) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
}

if (failed.length) {
  process.exitCode = 1;
}
