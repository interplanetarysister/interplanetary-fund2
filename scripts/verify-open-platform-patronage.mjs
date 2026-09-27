import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p, import.meta.url),'utf8');
const recipes = read('base44/lib/platformConnectionRecipes.ts');
const resolver = read('base44/functions/resolvePlatformConnectionRecipe/entry.ts');
const entity = read('base44/entities/PlatformConnection.jsonc');
const catalog = read('src/components/connections/platformCatalog.js');
const oauth = read('base44/functions/finalizeAppUserOAuthConnection/entry.ts');

for (const provider of ['justgiving','globalgiving']) {
  assert.match(recipes, new RegExp('\\b'+provider+':'), provider+' missing shared recipe');
  assert.match(resolver, new RegExp('\\b'+provider+':'), provider+' missing runtime recipe');
  assert.match(entity, new RegExp('"'+provider+'"'), provider+' missing PlatformConnection enum');
  assert.match(catalog, new RegExp('id: "'+provider+'"'), provider+' missing connection catalog entry');
}
assert.match(recipes, /manage_membership_tiers/);
assert.match(resolver, /manage_membership_tiers/);
assert.match(oauth, /PATREON_DESIRED_CAPABILITIES/);
assert.match(oauth, /manage_membership_tiers/);
assert.doesNotMatch(oauth, /patreon:\s*\{[^}]*requestedCapabilities:\s*COMMON_IF_CAPABILITIES/);
assert.match(oauth, /granted_capabilities: sharedAgentConsent \? confirmed : \[\]/);
assert.doesNotMatch(oauth, /granted_capabilities:\s*cfg\.requestedCapabilities/);
console.log('Open platform + patronage contract passed.');
