import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql = readFileSync(new URL('./owner-proof-rpcs.sql', import.meta.url), 'utf8');
test('three legacy functions and two audited RPCs are definer-only, pinned search_path, and service role gated', () => {
  assert.equal((sql.match(/SECURITY DEFINER/g) || []).length, 5);
  assert.equal((sql.match(/SET search_path = pg_catalog/g) || []).length, 5);
  assert.equal((sql.match(/request\.jwt\.claim\.role/g) || []).length, 5);
  assert.equal((sql.match(/= 'service_role'/g) || []).length, 3);
});
test('three legacy functions and two audited RPCs revoke public, anon and authenticated, grant service_role', () => {
  assert.equal((sql.match(/REVOKE ALL ON FUNCTION .* FROM PUBLIC, anon, authenticated/g) || []).length, 5);
  assert.equal((sql.match(/GRANT EXECUTE ON FUNCTION .* TO service_role/g) || []).length, 5);
});
test('commit is single atomic UPDATE, requires null link and expected state', () => {
  assert.match(sql, /UPDATE ifund_migration\.owner_identity_map/);
  assert.match(sql, /m\.verification_state = 'awaiting_destination_login'/);
  assert.match(sql, /m\.destination_auth_uid IS NULL/);
  assert.match(sql, /u\.id = p_destination_auth_uid/);
  assert.match(sql, /u\.email_confirmed_at IS NOT NULL/);
  assert.match(sql, /lower\(btrim\(m\.source_email\)\) = lower\(btrim\(p_expected_email\)\)/);
  assert.match(sql, /lower\(btrim\(u\.email\)\) = lower\(btrim\(p_expected_email\)\)/);
  const originalCommit = sql.split('CREATE OR REPLACE FUNCTION public.ifund_migration_owner_commit(')[1].split('REVOKE ALL ON FUNCTION public.ifund_migration_owner_commit')[0];
  assert.doesNotMatch(originalCommit, /candidate_auth_uid\s*=/);
  assert.match(sql, /AND m\.candidate_match_method IS NULL/);
  assert.match(sql, /FROM auth\.sessions AS s/);
  assert.match(sql, /s\.user_id = p_destination_auth_uid/);
  assert.match(sql, /s\.not_after IS NULL OR s\.not_after > now\(\)/);
});
test('additive V2 owner lookup exposes candidate provenance without changing old return type', () => {
  assert.match(sql, /FUNCTION public\.ifund_migration_owner_lookup_v2\(p_source_owner_id text\)/);
  assert.match(sql, /destination_auth_uid uuid, candidate_match_method text/);
  assert.match(sql, /m\.destination_auth_uid, m\.candidate_match_method/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.ifund_migration_owner_lookup_v2\(text\) FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.ifund_migration_owner_lookup_v2\(text\) TO service_role/);
  assert.match(sql, /DROP FUNCTION public\.ifund_migration_owner_lookup_v2\(text\)/);
});

test('SQL commit rejects email-only candidate and missing live session independently of the JS gate', () => {
  const body = sql.split('CREATE OR REPLACE FUNCTION public.ifund_migration_owner_commit(')[1].split('REVOKE ALL ON FUNCTION public.ifund_migration_owner_commit')[0];
  assert.match(body, /m\.candidate_match_method IS NULL/);
  assert.match(body, /EXISTS \(\s*SELECT 1 FROM auth\.sessions AS s/);
  assert.match(body, /s\.user_id = p_destination_auth_uid/);
  assert.match(body, /s\.not_after IS NULL OR s\.not_after > now\(\)/);
  assert.doesNotMatch(body, /OR m\.candidate_match_method/);
});

test('private consent audit persists replay-resistant receipts with tenant references and RLS', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS ifund_migration\.owner_link_consent_audit/);
  assert.match(sql, /consent_nonce_sha256 text PRIMARY KEY CHECK/);
  assert.match(sql, /REFERENCES ifund_migration\.owner_identity_map\(source_owner_id\) ON DELETE RESTRICT/);
  assert.match(sql, /REFERENCES auth\.users\(id\) ON DELETE RESTRICT/);
  assert.match(sql, /ALTER TABLE ifund_migration\.owner_link_consent_audit ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE ifund_migration\.owner_link_consent_audit FROM PUBLIC, anon, authenticated/);
});
test('historical owner upgrade is service-only, atomic, and does not reassign destination', () => {
  const body = sql.split('CREATE OR REPLACE FUNCTION public.ifund_migration_owner_upgrade_historical(')[1].split('REVOKE ALL ON FUNCTION public.ifund_migration_owner_upgrade_historical')[0];
  assert.match(body, /current_setting\('request\.jwt\.claim\.role', true\) IS DISTINCT FROM 'service_role'/);
  assert.match(body, /m\.verification_state = 'verified'/);
  assert.match(body, /m\.candidate_match_method = 'confirmed_exact_email'/);
  assert.match(body, /m\.candidate_auth_uid = p_destination_auth_uid/);
  assert.match(body, /m\.destination_auth_uid = p_destination_auth_uid/);
  assert.match(body, /s\.user_id = p_destination_auth_uid/);
  assert.match(body, /SET candidate_auth_uid = NULL,/);
  assert.match(body, /candidate_match_method = NULL,/);
  assert.match(body, /INSERT INTO ifund_migration\.owner_link_consent_audit/);
  assert.doesNotMatch(body, /SET\s+destination_auth_uid\s*=/);
});
test('audited upgrade signature and receipt constraints fail closed', () => {
  const signature = 'text,uuid,text,text,text,timestamptz,timestamptz';
  assert.match(sql, new RegExp('REVOKE ALL ON FUNCTION public\\.ifund_migration_owner_upgrade_historical\\(' + signature + '\\) FROM PUBLIC, anon, authenticated'));
  assert.match(sql, new RegExp('GRANT EXECUTE ON FUNCTION public\\.ifund_migration_owner_upgrade_historical\\(' + signature + '\\) TO service_role'));
  assert.match(sql, /p_consent_nonce_sha256 !~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(sql, /p_source_session_checked_at < now\(\) - interval '60 seconds'/);
  assert.match(sql, /p_destination_session_checked_at < now\(\) - interval '60 seconds'/);
  assert.match(sql, /consent_version = 'ifund-owner-link-v1'/);
});


test('new owner link requires atomic audited receipt and service-only execution', () => {
  const body = sql.split('CREATE OR REPLACE FUNCTION public.ifund_migration_owner_commit_audited(')[1]
    ?.split('REVOKE ALL ON FUNCTION public.ifund_migration_owner_commit_audited')[0];
  assert.ok(body, 'audited new-link RPC is required');
  assert.match(body, /request\.jwt\.claim\.role', true\) IS DISTINCT FROM 'service_role'/);
  assert.match(body, /m\.verification_state = 'awaiting_destination_login'/);
  assert.match(body, /m\.destination_auth_uid IS NULL/);
  assert.match(body, /m\.candidate_match_method IS NULL/);
  assert.match(body, /s\.user_id = p_destination_auth_uid/);
  assert.match(body, /p_consent_nonce_sha256 IS NULL/);
  assert.match(body, /p_source_session_checked_at < now\(\) - interval '60 seconds'/);
  assert.match(body, /p_destination_session_checked_at < now\(\) - interval '60 seconds'/);
  assert.match(body, /IF NOT FOUND THEN RETURN; END IF;\s+INSERT INTO ifund_migration\.owner_link_consent_audit/);
  assert.match(body, /'ifund-owner-link-v1', 'new_link'/);
  assert.doesNotMatch(body, /SET\s+candidate_auth_uid\s*=/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.ifund_migration_owner_commit_audited\(text,uuid,text,text,text,timestamptz,timestamptz\) FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.ifund_migration_owner_commit_audited\(text,uuid,text,text,text,timestamptz,timestamptz\) TO service_role/);
});

test('legacy unaudited owner commit loses service-role EXECUTE after all grants', () => {
  const signature = 'public.ifund_migration_owner_commit(text,uuid,text)';
  const grant = 'GRANT EXECUTE ON FUNCTION ' + signature + ' TO service_role;';
  const revoke = 'REVOKE ALL ON FUNCTION ' + signature + ' FROM service_role;';
  const executable = sql.split('\n').filter(line => !/^\s*--/.test(line)).join('\n');
  assert.ok(executable.includes(grant), 'existing legacy grant is recognized');
  assert.ok(executable.includes(revoke), 'legacy grant must be revoked');
  assert.ok(executable.lastIndexOf(revoke) > executable.lastIndexOf(grant), 'final privilege state must deny legacy commit');
  assert.equal(executable.slice(executable.lastIndexOf(revoke) + revoke.length).includes(grant), false);
});
