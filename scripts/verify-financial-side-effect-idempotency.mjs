import fs from "node:fs";
import path from "node:path";

const checks = [
  {
    file: "base44/functions/requestWithdrawal/entry.ts",
    label: "withdrawal decision is conditional",
    patterns: [/updateMany\(\{\s*id:\s*w\.id[\s\S]{0,240}review_action/i, /status:\s*\"processing\"/i],
  },
  {
    file: "base44/functions/requestWithdrawal/entry.ts",
    label: "provider payout identity is deterministic",
    patterns: [/IFW_/i, /custom_id|sender_batch_id/i],
  },
  {
    file: "base44/functions/requestWithdrawal/entry.ts",
    label: "unknown provider outcomes do not become paid",
    patterns: [/processing/i, /SUCCESS/i, /reconcile/i],
  },
  {
    file: "base44/functions/fraudControlAction/entry.ts",
    label: "moderation decision is conditional",
    patterns: [/updateMany\(\{\s*id:/i, /review_action/i],
  },
];

const root = process.cwd();
let failed = false;

for (const check of checks) {
  const filePath = path.join(root, check.file);
  if (!fs.existsSync(filePath)) {
    console.error(`FAIL ${check.label}: missing ${check.file}`);
    failed = true;
    continue;
  }

  const source = fs.readFileSync(filePath, "utf8");
  const missing = check.patterns.filter((pattern) => !pattern.test(source));
  if (missing.length) {
    console.error(`FAIL ${check.label}: ${check.file}`);
    for (const pattern of missing) console.error(`  missing pattern ${pattern}`);
    failed = true;
    continue;
  }

  console.log(`PASS ${check.label}: ${check.file}`);
}

console.log(
  "NOTE: This verifier is static evidence only. It does not prove Development runtime behavior, deployed Convex topology, provider reconciliation, or Production safety.",
);

if (failed) process.exit(1);
