import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const recipes = readFileSync('base44/lib/platformConnectionRecipes.ts', 'utf8');
const resolver = readFileSync('base44/functions/resolvePlatformConnectionRecipe/entry.ts', 'utf8');
const worker = readFileSync('base44/functions/runBrowserConnection/entry.ts', 'utf8');
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
assert.match(sync, /recordCanonicalExternalObservation/);
assert.match(sync, /withdrawable_imported:\s*0/);

console.log('platform connection scope contract: ok');
