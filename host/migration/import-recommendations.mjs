// Convert an authorized full Base44 Recommendation export to a private Supabase SQL migration.
// No credentials, network calls, metered builds, or live agent execution.
// Usage: node host/migration/import-recommendations.mjs /secure/export.json > /secure/recommendations.sql
// Review output and run it in a trusted Supabase SQL session. Do not commit export or generated SQL.
import { readFile } from 'node:fs/promises';
const [file] = process.argv.slice(2);
if (!file) throw Error('Expected authorized JSON export path');
const rows = JSON.parse(await readFile(file, 'utf8'));
if (!Array.isArray(rows) || rows.length !== 836) throw Error('Expected a full 836-record source snapshot');
const ids = new Set();
const fields = ['created_by_id','created_date','updated_date','campaign_id','campaign_title','owner_user_id','title','description','reasoning','evidence','confidence','expected_impact','estimated_effort','agent','status'];
for (const row of rows) {
  if (!row || typeof row.id !== 'string' || !/^[a-f0-9]{24}$/i.test(row.id) || ids.has(row.id))
    throw Error('Invalid or duplicate source id');
  ids.add(row.id);
}
const esc = value => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
process.stdout.write('begin;\n');
for (let i = 0; i < rows.length; i += 25) {
  const batch = rows.slice(i, i+25).map(row => ({
    entity_type: 'Recommendation', source_id: row.id,
    source_payload: Object.fromEntries(fields.filter(k => Object.hasOwn(row,k)).map(k => [k,row[k]])),
  }));
  process.stdout.write(
    'insert into ifund_migration.content_shadow(entity_type,source_id,source_payload) ' +
    "select x->>'entity_type',x->>'source_id',x->'source_payload' from jsonb_array_elements(" +
    esc(batch) + ') x on conflict(entity_type,source_id) do update set ' +
    "source_payload=coalesce(content_shadow.source_payload, '{}'::jsonb) || excluded.source_payload,imported_at=now();\n"
  );
}
process.stdout.write(
  "do $$ begin if (select count(*) from ifund_migration.content_shadow where entity_type='Recommendation') <> 836 " +
  "then raise exception 'Recommendation count parity failed'; end if; end $$;\ncommit;\n"
);
