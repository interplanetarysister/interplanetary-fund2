import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql = readFileSync(new URL('./independent-campaign-read.sql', import.meta.url), 'utf8');
const worker = process.env.IFUND_WORKER_SOURCE;

test('RPC is read-only and matches existing Worker route', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.ifund_migration_my_campaigns\(\)/);
  assert.match(sql, /LANGUAGE sql STABLE SECURITY DEFINER/);
  assert.match(sql, /SET search_path = pg_catalog/);
  assert.doesNotMatch(sql.replace(/^--.*$/gm, ''), /\b(INSERT|UPDATE|DELETE|TRUNCATE|EXECUTE\s+FORMAT)\b/i);
  assert.match(sql, /LIMIT 50/);
  assert.match(sql, /ORDER BY c\.synced_at DESC, c\.source_id ASC/);
});
test('requires verified matching source and destination ownership', () => {
  assert.match(sql, /m\.verification_state = 'verified'/);
  assert.match(sql, /m\.destination_auth_uid = u\.id/);
  assert.match(sql, /c\.source_owner_id = m\.source_owner_id/);
  assert.match(sql, /lower\(btrim\(m\.source_email\)\) = lower\(btrim\(u\.email\)\)/);
  assert.match(sql, /u\.id = auth\.uid\(\)/);
  assert.match(sql, /u\.email_confirmed_at IS NOT NULL/);
  assert.match(sql, /request\.jwt\.claim\.role', true\) = 'authenticated'/);
});
test('anonymous and authenticated access remain revoked until owner proof', () => {
  const executable = sql.replace(/^--.*$/gm, '');
  assert.match(executable, /REVOKE ALL ON FUNCTION public\.ifund_migration_my_campaigns\(\) FROM PUBLIC, anon, authenticated;/);
  assert.match(executable, /GRANT EXECUTE ON FUNCTION public\.ifund_migration_my_campaigns\(\) TO service_role;/);
  assert.doesNotMatch(executable, /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.ifund_migration_my_campaigns\(\)\s+TO\s+authenticated/i);
});
test('release requires real two-provider proof and has an explicit permission rollback', () => {
  assert.match(sql, /durable two-provider owner-session consent/);
  assert.match(sql, /negative cross-owner HTTP/);
  assert.match(sql, /email-only owner mappings are NOT proof/);
  assert.match(sql, /Emergency permission rollback after release/);
});
test('only explicit campaign preview fields; never financial snapshots or private metadata', () => {
  const table = sql.match(/RETURNS TABLE \(([\s\S]*?)\)\s*LANGUAGE/)[1];
  const cols = [...table.matchAll(/^\s*(\w+)\s+(?:uuid|text|numeric|date)\s*,?\s*$/gm)].map(m=>m[1]);
  assert.deepEqual(cols, ['owner_auth_uid','source_id','title','summary','story','status','category','goal_amount','cover_image_url','end_date','location','source_updated_at']);
  assert.match(sql, /c\.financial_authoritative = false/);
  assert.doesNotMatch(sql.replace(/^--.*$/gm,''), /raised_amount_snapshot|donor_count_snapshot|cashapp_tag|ai_profile|outreach_last_error|\bSELECT\s+\*/i);
});
test('never activate this RPC before verified owner-link identities', () => {
  assert.match(sql, /SOURCE ONLY: DO NOT APPLY/);
  assert.match(sql, /DROP FUNCTION IF EXISTS public\.ifund_migration_my_campaigns\(\)/);
});
