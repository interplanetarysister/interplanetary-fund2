import assert from "node:assert/strict";
import fs from "node:fs/promises";

const panel = await fs.readFile(new URL("../src/components/platform/FraudControlPanel.jsx", import.meta.url), "utf8");
const withdrawal = await fs.readFile(new URL("../base44/functions/requestWithdrawal/entry.ts", import.meta.url), "utf8");
const paypal = await fs.readFile(new URL("../base44/shared/paypal.ts", import.meta.url), "utf8");
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
assert.match(withdrawal, /review_action:\s*["']approve["']/,
  "Withdrawal approval must record the authoritative review decision while processing");
assert.match(withdrawal, /payout_claim_token:\s*claimToken/,
  "Withdrawal approval must persist an opaque payout claim token");
assert.match(withdrawal, /status:\s*["']processing["']/,
  "Withdrawal approval must enter processing before the irreversible provider payout");
assert.match(withdrawal, /payout_batch_id:\s*payout\.payout_batch_id/,
  "Approved payouts must persist the provider payout identifier");
assert.match(withdrawal, /status:\s*["']paid["']/,
  "The authoritative workflow must own the paid-state transition");
assert.match(withdrawal, /itemId:\s*`IFW_\$\{w\.id\}`/,
  "Approved payouts must retain the deterministic provider identity");
assert.match(withdrawal, /action === ["']reconcileApprove["']/,
  "Approval-owned processing withdrawals must have an explicit provider reconciliation action");
assert.match(withdrawal, /reconcileApprovedPayout\(/,
  "Approval workflow must use the deterministic provider reconciliation helper");
assert.match(withdrawal, /PayPal accepted the payout but local finalization is pending/,
  "Provider-success/local-write failure must remain recoverable rather than failed");
assert.match(withdrawal, /w\.review_action\s*===\s*["']deny["']/,
  "Approval must refuse a withdrawal already claimed by the denial workflow");

assert.match(paypal, /sender_batch_id:\s*senderBatchId/,
  "PayPal payout identity must be deterministic rather than time-based");
assert.match(paypal, /export async function getPayoutBatch\(/,
  "PayPal helper must support deterministic payout-batch reconciliation");
assert.match(paypal, /\/v1\/payments\/payouts\//,
  "PayPal helper must query the payout batch endpoint for recovery");

assert.match(moderation, /user\.role\s*!==\s*["']admin["']/,
  "Moderation workflow must enforce server-side admin authorization");
assert.match(moderation, /action === ["']denyWithdrawal["']/,
  "Moderation workflow must expose an explicit withdrawal-denial action");
assert.match(moderation, /status:\s*["']processing["'][\s\S]*review_action:\s*["']deny["']/,
  "Withdrawal denial must claim the decision before releasing reserved donations");
assert.match(moderation, /Donation\.updateMany\(/,
  "Withdrawal denial must reconcile reserved donations through the server workflow");
assert.match(moderation, /Donation\.filter\(/,
  "Withdrawal denial must re-read reservation state after release for recoverable finalization");
assert.match(moderation, /reconciliation\.complete/,
  "Withdrawal denial must refuse terminal finalization until donation reconciliation is complete");
assert.match(moderation, /status:\s*["']processing["'],\s*review_action:\s*["']deny["']/,
  "Withdrawal denial finalization must conditionally own the claimed decision");
assert.match(moderation, /status:\s*["']failed["']/,
  "Withdrawal denial must finalize the claimed decision only after reconciliation");
assert.match(moderation, /Retry the denial action/,
  "Withdrawal denial must expose a safe recoverable retry path after partial failure");
assert.match(moderation, /action === ["']pauseCampaign["']|action === ["']restoreCampaign["']/,
  "Moderation workflow must own campaign pause/restore actions");
assert.match(moderation, /Campaign\.updateMany\(/,
  "Campaign moderation must use conditional state transitions");
assert.match(moderation, /moderated_by_id:\s*user\.id/,
  "Campaign moderation must record the administrator identity");
assert.match(moderation, /moderated_at:\s*now/,
  "Campaign moderation must record the decision timestamp");

for (const field of ["owner_user_id", "campaign_id", "gross_amount", "net_amount", "status", "payout_batch_id", "review_note", "processed_at"]) {
  assert.match(withdrawalSchema, new RegExp(`"${field}"`), `Withdrawal schema must preserve ${field}`);
}
assert.match(withdrawalSchema, /"payout_claim_token"/, "Withdrawal schema must persist the payout claim token");
assert.match(withdrawalSchema, /"review_action"/, "Withdrawal schema must persist the authoritative review decision claim");
assert.match(withdrawalSchema, /"reviewed_by_id"/, "Withdrawal schema must persist the reviewing administrator");
for (const field of ["title", "summary", "story", "goal_amount", "raised_amount", "donor_count", "status", "cover_image_url", "end_date", "location", "location_lat", "location_lng", "cashapp_tag", "ai_profile", "story_versions", "outreach_enabled", "outreach_paused"]) {
  assert.match(campaignSchema, new RegExp(`"${field}"`), `Campaign schema must preserve ${field}`);
}
assert.match(campaignSchema, /"moderated_by_id"/, "Campaign schema must persist the moderating administrator");
assert.match(campaignSchema, /"moderation_note"/, "Campaign schema must persist the moderation reason");

console.log("Fraud approval, deterministic payout reconciliation, denial recovery, schema preservation, and campaign-moderation workflow verification passed.");
