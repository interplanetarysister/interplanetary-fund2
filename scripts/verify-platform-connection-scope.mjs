import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const recipes = readFileSync('base44/lib/platformConnectionRecipes.ts', 'utf8');
const resolver = readFileSync('base44/functions/resolvePlatformConnectionRecipe/entry.ts', 'utf8');
const worker = readFileSync('base44/functions/runBrowserConnection/entry.ts', 'utf8');
const catalog = readFileSync('src/components/connections/platformCatalog.js', 'utf8');
const oauthFinalize = readFileSync('base44/functions/finalizeAppUserOAuthConnection/entry.ts', 'utf8');
const verify = readFileSync('base44/functions/verifyPlatformConnection/entry.ts', 'utf8');
const sync = readFileSync('base44/functions/syncExternalFunds/entry.ts', 'utf8');

const browserCrowdfunding = ['gofundme','kickstarter','indiegogo','fundrazr','givesendgo','spotfund'];
for (const provider of browserCrowdfunding) {
  const start = recipes.indexOf(`${provider}:`);
  assert.notEqual(start, -1, `${provider} recipe missing`);
  const block = recipes.slice(start, start + 420);
  assert.match(block, /connect:\s*\{\s*preferred_transport:\s*'public_browser'/, `${provider} must be connectable by public browser`);
  assert.match(block, /capabilities:\s*\['GET_METRICS'\]/, `${provider} browser connection must stay read-only`);
  assert.match(block, /read_metrics:\s*\{\s*preferred_transport:\s*'public_browser'/, `${provider} metrics route missing`);
}

for (const provider of browserCrowdfunding) {
  const start = resolver.indexOf(`${provider}:{connect:`);
  assert.notEqual(start, -1, `${provider} live resolver connect route missing`);
  const block = resolver.slice(start, start + 360);
  assert.match(block, /preferred_transport:'public_browser'/);
  assert.match(block, /required_capabilities:\['GET_METRICS'\]/);
}

assert.match(worker, /No run may create a Donation or mark a connection provider-verified/);
assert.match(worker, /Never sign in, submit forms, message people, make payments/);
assert.match(worker, /external_only:\s*true/);
assert.doesNotMatch(worker, /entities\.Donation\.create/);
assert.match(catalog, /id: "patreon"[\s\S]{0,350}setupKind: "token"/);
assert.match(catalog, /id: "tiktok"[\s\S]{0,500}Posting is not currently supported/);
assert.doesNotMatch(catalog, /id: "tiktok"[\s\S]{0,220}post campaign content/);
assert.doesNotMatch(recipes, /worker_key:\s*'patreonApi'/);
assert.doesNotMatch(resolver, /worker_key:'patreonApi'/);
assert.match(recipes, /patreon:\s*\{\s*connect:\s*\{\s*preferred_transport:\s*'token'/);
assert.doesNotMatch(oauthFinalize, /APP_USER_CONNECTOR_PATREON_ID/);
assert.match(oauthFinalize, /const APP_CAPABILITIES = \['read_account', 'read_resources'\]/);
assert.match(oauthFinalize, /const SOCIAL_CAPABILITIES =/);
assert.match(oauthFinalize, /const CROWDFUNDING_CAPABILITIES =/);
assert.doesNotMatch(oauthFinalize, /COMMON_IF_CAPABILITIES/);
assert.doesNotMatch(oauthFinalize, /CROWDFUNDING_CAPABILITIES[\s\S]{0,400}'transfer_or_payout'/);
assert.match(verify, /tracking_only:\s*true/);
assert.match(verify, /provider_authenticated:\s*false/);
assert.match(verify, /verification_status:\s*'unverified'/);
assert.match(verify, /external_only:\s*true/);
assert.match(sync, /recordCanonicalExternalObservation/);
assert.match(sync, /withdrawable_imported:\s*0/);

console.log('platform connection scope contract: ok');
