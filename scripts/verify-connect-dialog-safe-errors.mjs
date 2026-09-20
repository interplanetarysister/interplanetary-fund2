import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const read = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), "utf8");
const readSourceTree = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const absolute = path.join(directory, entry.name);
  if (entry.isDirectory()) return readSourceTree(absolute);
  return /\.(?:js|jsx|ts|tsx)$/.test(entry.name) ? [fs.readFileSync(absolute, "utf8")] : [];
}).join("\n");
const source = read("src/components/connections/ConnectDialog.jsx");
const save = read("base44/functions/saveConnectionCredentials/entry.ts");
const entity = read("base44/entities/PlatformConnection.jsonc");
const card = read("src/components/connections/ConnectionCard.jsx");
const totals = read("src/components/campaigns/CrossPlatformTotals.jsx");
const sync = read("base44/functions/syncExternalFunds/entry.ts");
const syncRun = read("base44/entities/SyncRun.jsonc");
const kofi = read("base44/functions/kofiWebhook/entry.ts");
const connectionList = read("base44/functions/listConnections/entry.ts");
const accountManagement = read("src/components/account/AccountManagement.jsx");
const postCampaignUpdate = read("base44/functions/postCampaignUpdate/entry.ts");
const publishPost = read("base44/functions/publishPost/entry.ts");
const broadcastPosts = read("base44/functions/broadcastPosts/entry.ts");
const syncConnections = read("base44/functions/syncConnections/entry.ts");
const socialPublish = read("base44/shared/socialPublish.ts");
const githubSync = read("base44/functions/syncGitHub/entry.ts");
const integrationRegistry = read("base44/shared/integrationRegistry.ts");
const userEntity = read("base44/entities/User.jsonc");
const externalAccounts = read("src/lib/externalAccounts.js");
const accountDetail = read("src/components/admin/AccountDetailPanel.jsx");
const actionQueue = read("src/components/admin/ActionQueuePanel.jsx");
const runtimeGate = read("scripts/require-node22.mjs");
const frontendSources = readSourceTree(path.join(appRoot, "src"));
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
assert.match(source, /existing \? \(existing\.external_currency \|\| ""\) : "USD"/);
assert.doesNotMatch(source, /existing\?\.external_currency \|\| "USD"/);

assert.match(save, /base44\.auth\.me\(\)/);
assert.match(save, /Campaign\.get\(effectiveCampaignId\)/);
assert.match(save, /campaign\.created_by_id !== user\.id/);
assert.match(save, /user\.role !== 'admin'/);
assert.match(save, /external_total must be a non-negative number/);
assert.match(save, /external_donor_count must be a non-negative integer/);
assert.match(save, /\^\[A-Z\]\{3\}\$/);
assert.match(save, /status: 'disconnected'/);
assert.match(save, /verification_status: 'unverified'/);
assert.match(save, /external_data_source: 'owner_reported'/);
assert.doesNotMatch(save, /status: 'connected'/);
assert.match(save, /effectiveAutomationMode === 'auto'/);
assert.match(save, /hasAiPublishingConsent\(consentOwner\)/);
assert.doesNotMatch(save, /existing\?\.external_currency \|\| 'USD'/);

assert.match(entity, /"status":\s*\{[\s\S]*?"default":\s*"disconnected"/);
assert.match(entity, /"verification_status"/);
assert.match(entity, /"external_data_source"/);
assert.match(card, /Provider verified/);
assert.match(card, /owner reported/i);
assert.doesNotMatch(card, /status:\s*["']connected["']/);
assert.match(totals, /Reported USD total/);
assert.match(totals, /not Interplanetary Fund-withdrawable/i);
assert.match(totals, /excludedCurrencies/);
assert.match(totals, /external_currency === "USD"/);
assert.match(totals, /UNSPECIFIED/);
assert.doesNotMatch(totals, /external_currency \|\| "USD"/);
assert.match(card, /UNSPECIFIED/);
assert.doesNotMatch(card, /external_currency \|\| "USD"/);

assert.match(sync, /discoveredByCurrency/);
assert.match(sync, /discovered_totals: discoveredTotals/);
assert.match(sync, /total_discovered: totalDiscoveredUsd/);
assert.match(sync, /c\.created_by_id !== user\.id/);
assert.match(sync, /if \(!user\)/);
assert.match(sync, /Scheduled synchronization requires a trusted authenticated invocation/);
assert.doesNotMatch(sync, /user \? 'user' : 'scheduled'/);
assert.doesNotMatch(sync, /observed=\$\$\{totalDiscovered\}/);
assert.match(syncRun, /"discovered_totals"/);
assert.match(kofi, /verification_status:\s*'verified'/);
assert.match(kofi, /external_data_source:\s*'provider_verified'/);

assert.doesNotMatch(
  frontendSources,
  /base44\.entities\.PlatformConnection\s*\.\s*(?:list|filter|get)\s*\(/,
  "frontend code must use the redacting listConnections backend instead of reading PlatformConnection secrets directly"
);
assert.match(connectionList, /redactCredentials\(c\.credentials\)/);
assert.match(accountManagement, /\.map\(\(\{ credentials, credentials_meta, \.\.\.connection \}\) => connection\)/);

assert.match(socialPublish, /hasAiPublishingConsent/);
assert.match(postCampaignUpdate, /hasAiPublishingConsent\(consentOwner\)/);
assert.match(postCampaignUpdate, /assertPlatformAccess\(sr, 'social_publish'\)/);
assert.match(postCampaignUpdate, /assertOboGrant/);
assert.match(postCampaignUpdate, /platformAccess\.ok && obo\.ok/);
assert.match(syncConnections, /hasAiPublishingConsent\(owner\)/);
assert.match(syncConnections, /connection\.created_by_id === campaign\.created_by_id/);
assert.match(syncConnections, /post\.created_by_id === campaign\.created_by_id/);
assert.match(publishPost, /hasAiPublishingConsent\(consentOwner\)/);
assert.match(broadcastPosts, /hasAiPublishingConsent\(consentOwner\)/);

assert.doesNotMatch(githubSync, /Deno\.Command/);
assert.match(githubSync, /native GitHub synchronization control/);
assert.match(githubSync, /if \(!user\) return Response\.json\(\{ error: 'Unauthorized' \}/);
assert.match(githubSync, /anySucceeded \? 'partial' : 'failed'/);

assert.match(integrationRegistry, /registry unavailable \(fail-closed\)/);
assert.doesNotMatch(integrationRegistry, /registry unavailable \(fail-open\)/);
assert.match(userEntity, /"ai_publishing_consent"/);
assert.match(userEntity, /"granted"/);
assert.match(externalAccounts, /credentials_meta/);
assert.match(externalAccounts, /bluesky_app_password_set/);
assert.match(accountDetail, /UNSPECIFIED/);
assert.doesNotMatch(actionQueue, /last_error:\s*""/);
assert.doesNotMatch(actionQueue, /status:\s*"disconnected"/);
assert.match(runtimeGate, /const SUPPORTED = \[22\];/);
assert.doesNotMatch(runtimeGate, /SUPPORTED\s*=\s*\[[^\]]*20/);

assert.doesNotMatch(adminSources, /status:\s*["']connected["']/);
assert.doesNotMatch(adminSources, /last_synced:\s*now/);
assert.match(adminSources, /provider verification is still required/i);

const diagnosticIndex = source.indexOf('console.error("ConnectDialog connection save failed:", e)');
const safeMessageIndex = source.indexOf('setError("Couldn\'t save this connection. Please try again. If the problem continues, contact support.")');
assert.ok(diagnosticIndex >= 0 && safeMessageIndex > diagnosticIndex, "controlled diagnostics must precede the safe client message");

console.log("Connection authorization and data-truth contract passed");
