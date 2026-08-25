import assert from "node:assert/strict";
import fs from "node:fs/promises";

const panel = await fs.readFile(new URL("../src/components/platform/FraudControlPanel.jsx", import.meta.url), "utf8");
const withdrawal = await fs.readFile(new URL("../base44/functions/requestWithdrawal/entry.ts", import.meta.url), "utf8");
const moderation = await fs.readFile(new URL("../base44/functions/fraudControlAction/entry.ts", import.meta.url), "utf8");
const withdrawalSchema = await fs.readFile(new URL("../base44/entities/Withdrawal.jsonc", import.meta.url), "utf8");
const campaignSchema = await fs.readFile(new URL("../base44/entities/Campaign.jsonc", import.meta.url), "utf8");

assert.match(panel, /base44\.functions\.invoke\(\s*["']requestWithdrawal["']\s*,\s*\{[\s\S]*action:\s*["']approve["']/,
  "Fraud Control approval must invoke the authoritative requestWithdrawal approve action");
assert.doesNotMatch(panel, /Withdrawal\.update\(\s*w\.id\s*,\s*\{\s*status:\s*["']paid["']/,
  "Fraud Control must not directly mark withdrawals paid");
assert.match(panel, /base44\.functions\.invoke\(\s*["']fraudControlAction["']/,
  "Fraud Control denial and campaign moderation must use the authoritative moderation workflow");
assert.doesNotMatch(panel, /base44\.entities\.Withdrawal\.update\(/,
  "Fraud Control must not directly mutate withdrawal state");
assert.doesNotMatch(panel, /base44\.entities\.Campaign\.update\(/,
  "Fraud Control must not directly mutate campaign moderation state");

assert.match(withdrawal, /if\s*\(action\s*===\s*["']approve["']\)[\s\S]*sendPayout\(/,
  "requestWithdrawal must retain the provider-payout approval workflow");
assert.match(withdrawal, /id:\s*w\.id,\s*status:\s*["']under_review["']/,
  "Withdrawal approval must use a conditional single-winner state claim");
assert.match(withdrawal, /payout_claim_token:\s*claimToken/,
  "Withdrawal approval must persist an opaque payout claim token");
assert.match(withdrawal, /status:\s*["']processing["']/,
  "Withdrawal approval must enter processing before the irreversible provider payout");
assert.match(withdrawal, /payout_batch_id:\s*payout\.payout_batch_id/,
  "Approved payouts must persist the provider payout identifier");
assert.match(withdrawal, /status:\s*["']paid["']/,
  "The authoritative workflow must own the paid-state transition");
assert.match(withdrawal, /itemId:\s*`IFW_\$\{w\.id\}`/,
  "Approved payouts must retain the deterministic provider idempotency identity");

assert.match(moderation, /user\.role\s*!==\s*["']admin["']/,
  "Moderation workflow must enforce server-side admin authorization");
assert.match(moderation, /action === ["']denyWithdrawal["']/,
  "Moderation workflow must expose an explicit withdrawal-denial action");
assert.match(moderation, /Withdrawal\.updateMany\(/,
  "Withdrawal denial must use a conditional state transition");
assert.match(moderation, /withdrawal_id:\s*withdrawal\.id/,
  "Withdrawal denial must release only donations reserved by that withdrawal");
assert.match(moderation, /Donation\.updateMany\(/,
  "Withdrawal denial must reconcile reserved donations through the server workflow");
assert.match(moderation, /action === ["']pauseCampaign["']|action === ["']restoreCampaign["']/,
  "Moderation workflow must own campaign pause/restore actions");
assert.match(moderation, /Campaign\.updateMany\(/,
  "Campaign moderation must use conditional state transitions");
assert.match(moderation, /moderated_by_id:\s*user\.id/,
  "Campaign moderation must record the administrator identity");
assert.match(moderation, /moderated_at:\s*now/,
  "Campaign moderation must record the decision timestamp");
assert.match(withdrawalSchema, /"payout_claim_token"/,
  "Withdrawal schema must persist the payout claim token");
assert.match(withdrawalSchema, /"reviewed_by_id"/,
  "Withdrawal schema must persist the reviewing administrator");
assert.match(campaignSchema, /"moderated_by_id"/,
  "Campaign schema must persist the moderating administrator");
assert.match(campaignSchema, /"moderation_note"/,
  "Campaign schema must persist the moderation reason");

console.log("Fraud approval, denial, payout-claim, and campaign-moderation workflow verification passed.");
