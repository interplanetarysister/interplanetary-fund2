import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(\`../\${path}\`, import.meta.url), "utf8");
const source = read("src/components/connections/ConnectDialog.jsx");
const save = read("base44/functions/saveConnectionCredentials/entry.ts");
const entity = read("base44/entities/PlatformConnection.jsonc");
const card = read("src/components/connections/ConnectionCard.jsx");
const totals = read("src/components/campaigns/CrossPlatformTotals.jsx");
const sync = read("base44/functions/syncExternalFunds/entry.ts");
const syncRun = read("base44/entities/SyncRun.jsonc");
const kofi = read("base44/functions/kofiWebhook/entry.ts");
const adminSources = [
  read("src/components/admin/ActionQueuePanel.jsx"),
  read("src/components/admin/AccountDetailPanel.jsx"),
  read("src/components/admin/ExternalAccountsTable.jsx"),
].join("\n");

assert.match(source, /setError\("Couldn't save this connection\. Please try again\. If the problem continues, contact support\."\)/);
assert.match(source, /console\.error\("ConnectDialog connection save failed:", e\)/);
assert.doesNotMatch(source, /setError\(e\.message/);
assert.doesNotMatch(source, /setError\(.*error\.message/);
assert.match(source, /base44\.functions\.invoke\(\s*["']saveConnectionCredentials["']\s*,/);
assert.doesNotMatch(source, /PlatformConnection\s*\.\s*(?:update|create)\s*\(/);
assert.match(source, /external_currency/);

assert.match(save, /base44\.auth\.me\(\)/);
assert.match(save, /Campaign\.get\(effectiveCampaignId\)/);
assert.match(save, /campaign\.created_by_id !== user\.id/);
assert.match(save, /user\.role !== 'admin'/);
assert.match(save, /External total must be a non-negative number/);
assert.match(save, /Donor count must be a non-negative integer/);
assert.match(save, /\^\[A-Z\]\{3\}\$/);
assert.match(save, /status: 'disconnected'/);
assert.match(save, /verification_status: 'unverified'/);
assert.match(save, /external_data_source: 'owner_reported'/);
assert.doesNotMatch(save, /status: 'connected'/);

assert.match(entity, /"status":\s*\{[\s\S]*?"default":\s*"disconnected"/);
assert.match(entity, /"verification_status"/);
assert.match(entity, /"external_data_source"/);
assert.match(card, /Provider verified/);
assert.match(card, /Owner reported/);
assert.doesNotMatch(card, /status:\s*["']connected["']/);
assert.match(totals, /Reported USD total/);
assert.match(totals, /not withdrawable/i);
assert.match(totals, /excludedCurrencies/);

assert.match(sync, /discoveredByCurrency/);
assert.match(sync, /discovered_totals: discoveredTotals/);
assert.match(sync, /total_discovered: totalDiscoveredUsd/);
assert.match(sync, /c\.created_by_id !== user\.id/);
assert.doesNotMatch(sync, /observed=\$\$\{totalDiscovered\}/);
assert.match(syncRun, /"discovered_totals"/);
assert.match(kofi, /verification_status:\s*'verified'/);
assert.match(kofi, /external_data_source:\s*'provider_verified'/);

assert.doesNotMatch(adminSources, /status:\s*["']connected["']/);
assert.doesNotMatch(adminSources, /last_synced:\s*now/);
assert.match(adminSources, /provider verification is still required/i);

const diagnosticIndex = source.indexOf('console.error("ConnectDialog connection save failed:", e)');
const safeMessageIndex = source.indexOf('setError("Couldn\'t save this connection. Please try again. If the problem continues, contact support.")');
assert.ok(diagnosticIndex >= 0 && safeMessageIndex > diagnosticIndex, "controlled diagnostics must precede the safe client message");

console.log("Connection authorization and data-truth contract passed");
