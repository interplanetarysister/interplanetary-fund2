import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql = readFileSync(new URL('./owner-proof-rpcs.sql', import.meta.url), 'utf8');
test('both functions are definer-only, pinned search_path, and service role gated', () => {
  assert.equal((sql.match(/SECURITY DEFINER/g) || []).length, 2);
  assert.equal((sql.match(/SET search_path = pg_catalog/g) || []).length, 2);
  assert.equal((sql.match(/request\.jwt\.claim\.role/g) || []).length, 2);
  assert.equal((sql.match(/= 'service_role'/g) || []).length, 2);
});
test('both functions revoke public, anon and authenticated, grant service_role', () => {
  assert.equal((sql.match(/REVOKE ALL ON FUNCTION .* FROM PUBLIC, anon, authenticated/g) || []).length, 2);
  assert.equal((sql.match(/GRANT EXECUTE ON FUNCTION .* TO service_role/g) || []).length, 2);
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
