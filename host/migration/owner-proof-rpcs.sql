-- IFund owner-proof bridge: private, service-only RPCs for dual-session gate.
-- Non-destructive. Does not link owners until a separate authenticated server
-- route calls commit with TWO live provider-verified sessions.
-- Apply only to existing Supabase project tzehxfikoslihnclhxuz.
-- Rollback: DROP FUNCTION public.ifund_migration_owner_commit(text,uuid,text);
--           DROP FUNCTION public.ifund_migration_owner_lookup(text);
--           DROP FUNCTION public.ifund_migration_owner_lookup_v2(text);

CREATE OR REPLACE FUNCTION public.ifund_migration_owner_lookup(p_source_owner_id text)
RETURNS TABLE(source_owner_id text, source_email text, verification_state text, destination_auth_uid uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $rpc$
  SELECT m.source_owner_id, m.source_email, m.verification_state, m.destination_auth_uid
  FROM ifund_migration.owner_identity_map AS m
  WHERE m.source_owner_id = p_source_owner_id
    AND current_setting('request.jwt.claim.role', true) = 'service_role'
$rpc$;

REVOKE ALL ON FUNCTION public.ifund_migration_owner_lookup(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ifund_migration_owner_lookup(text) TO service_role;

-- Versioned lookup: the original four-column RPC cannot distinguish a
-- confirmed-email candidate from a session-proven link. Do NOT silently
-- upgrade its return type: Postgres rejects CREATE OR REPLACE with a changed
-- TABLE result. This additive service-only function preserves rollback.
-- Source only; do not deploy the route until durable dual-provider consent.
CREATE OR REPLACE FUNCTION public.ifund_migration_owner_lookup_v2(p_source_owner_id text)
RETURNS TABLE(source_owner_id text, source_email text, verification_state text,
              destination_auth_uid uuid, candidate_match_method text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $rpc$
  SELECT m.source_owner_id, m.source_email, m.verification_state,
         m.destination_auth_uid, m.candidate_match_method
  FROM ifund_migration.owner_identity_map AS m
  WHERE m.source_owner_id = p_source_owner_id
    AND current_setting('request.jwt.claim.role', true) = 'service_role'
$rpc$;

REVOKE ALL ON FUNCTION public.ifund_migration_owner_lookup_v2(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ifund_migration_owner_lookup_v2(text) TO service_role;

CREATE OR REPLACE FUNCTION public.ifund_migration_owner_commit(
  p_source_owner_id text,
  p_destination_auth_uid uuid,
  p_expected_email text
)
RETURNS TABLE(linked boolean, source_owner_id text, destination_auth_uid uuid, verification_state text)
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog
AS $rpc$
  UPDATE ifund_migration.owner_identity_map AS m
  SET destination_auth_uid = p_destination_auth_uid,
      verification_state = 'verified',
      updated_at = now()
  WHERE m.source_owner_id = p_source_owner_id
    AND m.verification_state = 'awaiting_destination_login'
    AND m.destination_auth_uid IS NULL
    AND current_setting('request.jwt.claim.role', true) = 'service_role'
    AND lower(btrim(m.source_email)) = lower(btrim(p_expected_email))
    AND EXISTS (
      SELECT 1 FROM auth.users AS u
      WHERE u.id = p_destination_auth_uid
        AND u.email_confirmed_at IS NOT NULL
        AND lower(btrim(u.email)) = lower(btrim(p_expected_email))
    )
  RETURNING true, m.source_owner_id, m.destination_auth_uid, m.verification_state
$rpc$;

REVOKE ALL ON FUNCTION public.ifund_migration_owner_commit(text,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ifund_migration_owner_commit(text,uuid,text) TO service_role;
