import assert from "node:assert/strict";
import fs from "node:fs/promises";

const panel = await fs.readFile(new URL("../src/components/platform/FraudControlPanel.jsx", import.meta.url), "utf8");
const withdrawal = await fs.readFile(new URL("../base44/functions/requestWithdrawal/entry.ts", import.meta.url), "utf8");

assert.match(
  panel,
  /base44\.functions\.invoke\(\s*["']requestWithdrawal["']\s*,\s*\{[\s\S]*action:\s*["']approve["']/,
  "Fraud Control approval must invoke the authoritative requestWithdrawal approve action",
);
assert.doesNotMatch(
  panel,
  /Withdrawal\.update\(\s*w\.id\s*,\s*\{\s*status:\s*["']paid["']/,
  "Fraud Control must not directly mark withdrawals paid",
);
assert.match(
  withdrawal,
  /if\s*\(action\s*===\s*["']approve["']\)[\s\S]*sendPayout\(/,
  "requestWithdrawal must retain the provider-payout approval workflow",
);
assert.match(
  withdrawal,
  /payout_batch_id:\s*payout\.payout_batch_id/,
  "Approved payouts must persist the provider payout identifier",
);
assert.match(
  withdrawal,
  /status:\s*["']paid["']/,
  "The authoritative workflow must own the paid-state transition",
);

console.log("Fraud approval workflow verification passed.");
