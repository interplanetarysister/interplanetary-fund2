import assert from 'node:assert/strict';
import fs from 'node:fs';

const catalog = fs.readFileSync('src/components/connections/platformCatalog.js', 'utf8');
const entity = fs.readFileSync('base44/entities/PlatformConnection.jsonc', 'utf8');
const resolver = fs.readFileSync('base44/functions/resolveConnectionStatus/entry.ts', 'utf8');
const shared = fs.readFileSync('base44/functions/getSharedConnectorStatus/entry.ts', 'utf8');
const audit = fs.readFileSync('docs/CONNECTOR_CATALOG_AUDIT.md', 'utf8');

const entitySchema = JSON.parse(entity);
const allowed = entitySchema.properties.platform.enum;
const ids = [...catalog.matchAll(/\bid:\s*"([^"]+)"/g)].map((m) => m[1]);
assert.equal(new Set(ids).size, ids.length, 'platformCatalog contains duplicate ids');
for (const id of ids) assert.ok(allowed.includes(id), `UI catalog platform ${id} is missing from PlatformConnection enum`);

for (const required of [
  'gofundme','kickstarter','indiegogo','fundrazr','givesendgo','spotfund',
  'kofi','buymeacoffee','patreon','facebook','instagram','x','linkedin',
  'tiktok','discord','bluesky','mastodon','gmail','googledrive','googlecalendar',
  'slack','notion','github'
]) assert.ok(ids.includes(required), `required connection surface missing: ${required}`);

for (const sharedId of ['wix','slackbot']) {
  assert.match(shared + resolver + audit, new RegExp('\\b' + sharedId + '\\b', 'i'), `shared connector missing: ${sharedId}`);
}
assert.match(audit, /VERIFIED CONNECTED requires an actual successful provider-backed API call/i);
assert.match(resolver, /Configuration, recipes, saved credentials, or public URLs are NOT sufficient/);

console.log(`Connection catalog contract verified: ${ids.length} user-facing platforms plus shared connector coverage.`);
