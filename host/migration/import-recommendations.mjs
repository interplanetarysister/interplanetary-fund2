// Operator-run IFund Recommendation importer. No bundled data or credentials.
// Usage: node host/migration/import-recommendations.mjs /secure/path/recommendations.json
// Source export must come from an authorized Base44 account. No agent actions are activated.
// Requires IFUND_SUPABASE_URL and IFUND_SUPABASE_SERVICE_ROLE_KEY as runtime secrets.
// Run only in a trusted operator environment; do not commit the export or credentials.
import { readFile } from 'node:fs/promises';

const [file] = process.argv.slice(2);
const host = process.env.IFUND_SUPABASE_URL;
const key = process.env.IFUND_SUPABASE_SERVICE_ROLE_KEY;
if (!file || !host || !key) throw Error('Provide export path and runtime Supabase credentials');
const u = new URL(host);
if (u.protocol !== 'https:' || u.hostname !== 'tzehxfikoslihnclhxuz.supabase.co' ||
    u.pathname !== '/' || u.search || u.hash) throw Error('Unexpected Supabase project URL');
const rows = JSON.parse(await readFile(file, 'utf8'));
if (!Array.isArray(rows)) throw Error('Export must be a JSON array');
const unique = new Map();
for (const row of rows) {
  if (!row || typeof row.id !== 'string' || !/^[a-f0-9]{24}$/i.test(row.id)) throw Error('Invalid source id');
  if (unique.has(row.id)) throw Error('Duplicate source id in export');
  unique.set(row.id, row);
}
if (unique.size !== 836) throw Error('Expected full 836-record snapshot; refusing partial export');
const fields = ['id','title','status','agent','campaign_id','owner_user_id'];
const endpoint = new URL('/rest/v1/content_shadow?on_conflict=entity_type,source_id', u);
let processed = 0;
for (let i = 0; i < rows.length; i += 25) {
  const batch = rows.slice(i, i + 25).map(row => ({
    entity_type: 'Recommendation', source_id: row.id,
    source_payload: Object.fromEntries(fields.filter(k => Object.hasOwn(row,k)).map(k => [k,row[k]])),
  }));
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: key, authorization: 'Bearer ' + key,
      'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal',
      'accept-profile': 'ifund_migration', 'content-profile': 'ifund_migration',
    },
    body: JSON.stringify(batch), redirect: 'error',
  });
  if (!response.ok) throw Error('Batch failed at offset ' + i + ': HTTP ' + response.status);
  processed += batch.length;
  console.log('Staged ' + processed + '/' + rows.length);
}
console.log('Import requests completed; verify distinct row counts in Supabase before cutover.');
