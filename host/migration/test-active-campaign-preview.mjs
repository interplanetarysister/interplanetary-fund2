import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const sql = readFileSync(new URL('./active-campaign-preview.sql', import.meta.url), 'utf8');
const functionBody = sql.split('AS $rpc$')[1]?.split('$rpc$;')[0] || '';
test('function is a read-only security-definer with pinned search path', () => {
  assert.match(sql, /LANGUAGE sql STABLE SECURITY DEFINER\s+SET search_path = pg_catalog/);
  assert.match(functionBody.trim(), /^SELECT\b/i);
  assert.doesNotMatch(functionBody, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|EXECUTE|PERFORM)\b/i);
});
test('RPC requires server-side service-role claim and privilege', () => {
  assert.match(sql, /coalesce\(nullif\(current_setting\('request\.jwt\.claim\.role', true\), ''\), nullif\(current_setting\('request\.jwt\.claims', true\), ''\)::jsonb ->> 'role'\) = 'service_role'/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.ifund_migration_active_campaign_preview\(text,integer\)\s+FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.ifund_migration_active_campaign_preview\(text,integer\)\s+TO service_role/);
});
test('only active nonauthoritative campaign snapshots can appear', () => {
  assert.match(functionBody, /c\.status = 'active'/);
  assert.match(functionBody, /c\.financial_authoritative IS FALSE/);
  assert.match(sql, /preview_only boolean/);
  assert.match(functionBody, /true AS preview_only/);
});
test('response projection does not expose ownership, payment or agent data', () => {
  const projection = functionBody.split(/\bFROM\b/i)[0];
  for (const forbidden of ['source_owner_id','destination_auth_uid','raised_amount','donor_count','cashapp','crypto','payout','agent','story','location'])
    assert.equal(projection.toLowerCase().includes(forbidden), false, forbidden);
  assert.match(projection, /c\.source_id, c\.title, c\.summary, c\.category/);
});
test('cursor and deterministic bounded pagination are required', () => {
  assert.match(functionBody, /c\.source_id > p_after_source_id/);
  assert.match(functionBody, /ORDER BY c\.source_id ASC/);
  assert.match(functionBody, /LEAST\(GREATEST\(COALESCE\(p_limit, 24\), 1\), 50\)/);
});
test('rollback is a single explicit function drop', () => {
  assert.match(sql, /Rollback: DROP FUNCTION public\.ifund_migration_active_campaign_preview\(text,integer\)/);
});
