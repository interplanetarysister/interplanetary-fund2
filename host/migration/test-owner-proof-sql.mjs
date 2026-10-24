import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql = readFileSync(new URL('./owner-proof-rpcs.sql', import.meta.url), 'utf8');
test('all three functions are definer-only, pinned search_path, and service role gated', () => {
  assert.equal((sql.match(/SECURITY DEFINER/g) || []).length, 3);
  assert.equal((sql.match(/SET search_path = pg_catalog/g) || []).length, 3);
  assert.equal((sql.match(/request\.jwt\.claim\.role/g) || []).length, 3);
  assert.equal((sql.match(/= 'service_role'/g) || []).length, 3);
});
test('all three functions revoke public, anon and authenticated, grant service_role', () => {
  assert.equal((sql.match(/REVOKE ALL ON FUNCTION .* FROM PUBLIC, anon, authenticated/g) || []).length, 3);
  assert.equal((sql.match(/GRANT EXECUTE ON FUNCTION .* TO service_role/g) || []).length, 3);
});
test('commit is single atomic UPDATE, requires null link and expected state', () => {
  assert.match(sql, /UPDATE ifund_migration\.owner_identity_map/);
  assert.match(sql, /m\.verification_state = 'awaiting_destination_login'/);
  assert.match(sql, /m\.destination_auth_uid IS NULL/);
  assert.match(sql, /u\.id = p_destination_auth_uid/);
  assert.match(sql, /u\.email_confirmed_at IS NOT NULL/);
  assert.match(sql, /lower\(btrim\(m\.source_email\)\) = lower\(btrim\(p_expected_email\)\)/);
  assert.match(sql, /lower\(btrim\(u\.email\)\) = lower\(btrim\(p_expected_email\)\)/);
  assert.doesNotMatch(sql, /candidate_auth_uid\s*=/);
});
test('additive V2 owner lookup exposes candidate provenance without changing old return type', () => {
  assert.match(sql, /FUNCTION public\.ifund_migration_owner_lookup_v2\(p_source_owner_id text\)/);
  assert.match(sql, /destination_auth_uid uuid, candidate_match_method text/);
  assert.match(sql, /m\.destination_auth_uid, m\.candidate_match_method/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.ifund_migration_owner_lookup_v2\(text\) FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.ifund_migration_owner_lookup_v2\(text\) TO service_role/);
  assert.match(sql, /DROP FUNCTION public\.ifund_migration_owner_lookup_v2\(text\)/);
});
