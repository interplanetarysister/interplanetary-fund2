import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(path)=>readFileSync(path,'utf8');
const fn=read('base44/functions/manageOwnerConnectionConfiguration/entry.ts');
const context=read('base44/functions/getVerifiedIFundIntegrationContext/entry.ts');
const schema=JSON.parse(read('base44/entities/IntegrationChangeRequest.jsonc'));
for(const marker of ['assertActiveAccount','OWNER_EMAILS.has(clean(user.email))',"mode === 'prepare'","mode === 'execute'",'body.confirm !== true',"pending.owner_user_id !== user.id","pending.status !== 'pending'",'pending.expires_at','pending.expected_recipe_version','orderedTransports(existing || fallback)','status:\'probation\'','external_provider_modified:false']){
  assert.ok(fn.includes(marker),'Missing owner approval guard: '+marker);
}
assert.ok(!fn.includes('Deno.env.get('),'Owner mutation must not read raw credentials');
assert.ok(!fn.includes('fetch('),'Owner mutation must not call external URLs');
assert.ok(schema.properties.status.enum.includes('pending'));
assert.ok(schema.properties.status.enum.includes('applied'));
assert.ok(context.includes('config_mutation_authorized: false'));
assert.ok(context.includes('registration_verified: false'));
assert.ok(context.includes("'Cache-Control': 'no-store'"));
assert.ok(context.includes("PlatformConnectionRecipe.filter({ platform, operation: 'connect' })"),'Context must read active persisted connection routes');
assert.ok(context.includes("const disabled = selected?.status === 'disabled'"),'Disabled route must override built-in fallback');
assert.ok(context.includes("persisted_recipe_available: !!selected"),'Context must expose nonsecret source provenance');
console.log('IFund owner connection authority source checks passed');
