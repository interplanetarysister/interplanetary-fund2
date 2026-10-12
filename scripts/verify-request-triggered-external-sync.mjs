import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const sync = read("base44/functions/syncExternalFunds/entry.ts");
const imported = read("base44/functions/syncImportedCampaign/entry.ts");
const importFn = read("base44/functions/importExternalCampaign/entry.ts");
const importEntity = read("base44/entities/ExternalCampaignImport.jsonc");
const syncEntity = read("base44/entities/SyncRun.jsonc");
const connections = read("src/pages/Connections.jsx");
const count = read("src/components/account/CountMyMoney.jsx");
const migration = read("src/components/ops/FundMigrationDashboard.jsx");
const importedUi = read("src/components/campaigns/ImportedCampaignSync.jsx");
const capabilities = read("base44/shared/providerCapabilities.ts");
const requestGuard = read("base44/shared/externalSyncRequest.ts");
const claimEntity = read("base44/entities/ExternalSyncClaim.jsonc");
const createCampaign = read("src/pages/CreateCampaign.jsx");

assert.equal(fs.existsSync(path.join(root, "base44/workflows/External Fund Sync.jsonc")), false,
  "scheduled external fundraising sync workflow must remain absent");
assert.match(sync, /validExternalSyncRequestId/);
assert.match(sync, /request_id is required/);
assert.match(sync, /Scheduled, workflow, and agent synchronization is disabled/);
assert.match(requestGuard, /request_fingerprint/);
assert.match(sync, /beginExternalSyncRequest/);
assert.match(sync, /crowdfundingConnectionEligibility/);
assert.match(requestGuard, /EXTERNAL_SYNC_RATE_LIMIT = 5/);
assert.match(requestGuard, /ExternalSyncClaim\.upsert/);
assert.match(requestGuard, /Number\(claimResult\?\.created \|\| 0\) !== 1/);
assert.match(requestGuard, /active_claim_key !== claimKey/);
assert.match(claimEntity, /"claim_key"/);
assert.doesNotMatch(sync, /initiator_type === 'scheduled'/);
assert.doesNotMatch(sync, /initiator_id \|\| 'workflow'/);
assert.match(syncEntity, /"request_id"/);
assert.match(syncEntity, /"request_fingerprint"/);
assert.match(syncEntity, /"in_progress"/);

for (const source of [connections, count, migration, importedUi]) {
  assert.match(source, /request_id:\s*crypto\.randomUUID\(\)/);
}
assert.match(imported, /validExternalSyncRequestId/);
assert.match(imported, /beginExternalSyncRequest/);
assert.match(importFn, /beginExternalSyncRequest/);
assert.doesNotMatch(createCampaign, /discoverExternalCampaignSnapshot/);
assert.match(createCampaign, /request_id:\s*requestId/);
assert.doesNotMatch(imported, /record\.sync_enabled!==true/);
assert.match(importFn, /sync_enabled: false/);
assert.match(importEntity, /"default":\s*false/);
assert.match(importEntity, /never authorizes unattended sync/);
assert.match(capabilities, /poll_support is research metadata/);
assert.match(capabilities, /never authorizes IFund polling/);

// Financial-integrity automation is intentionally separate and preserved.
for (const file of [
  "base44/functions/kofiWebhook/entry.ts",
  "base44/functions/stripeWebhook/entry.ts",
  "base44/functions/matchExternalPayPalSettlement/entry.ts",
]) assert.equal(fs.existsSync(path.join(root, file)), true, `${file} must remain present`);

console.log("Request-triggered external fundraising sync contract passed");
