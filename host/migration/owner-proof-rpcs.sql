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
    -- Defense in depth: the service-only commit must not convert any
    -- candidate/email-only mapping even if a caller bypasses the JS gate.
    AND m.candidate_match_method IS NULL
    AND current_setting('request.jwt.claim.role', true) = 'service_role'
    AND lower(btrim(m.source_email)) = lower(btrim(p_expected_email))
    AND EXISTS (
      SELECT 1 FROM auth.users AS u
      WHERE u.id = p_destination_auth_uid
        AND u.email_confirmed_at IS NOT NULL
        AND lower(btrim(u.email)) = lower(btrim(p_expected_email))
    )
    -- A confirmed email or an auth.users row alone is not an active login.
    -- The trusted route must ALSO verify the exact destination bearer and
    -- the live Base44 bearer before invoking this service-only RPC.
    AND EXISTS (
      SELECT 1 FROM auth.sessions AS s
      WHERE s.user_id = p_destination_auth_uid
        AND (s.not_after IS NULL OR s.not_after > now())
    )
  RETURNING true, m.source_owner_id, m.destination_auth_uid, m.verification_state
$rpc$;

REVOKE ALL ON FUNCTION public.ifund_migration_owner_commit(text,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ifund_migration_owner_commit(text,uuid,text) TO service_role;

-- BEGIN STAGED OWNER CONSENT AUDIT V1 (SOURCE ONLY, NOT DEPLOYED)
-- Rollback after confirming no links use this function:
--   DROP FUNCTION public.ifund_migration_owner_upgrade_historical(text,uuid,text,text,text,timestamptz,timestamptz);
--   DROP TABLE ifund_migration.owner_link_consent_audit;
-- The route must verify BOTH live provider bearer sessions, explicit consent,
-- same-origin CSRF and durable rate limiting before invoking this service-only RPC.
-- Never store bearer tokens, provider session secrets or full CSRF challenges.
CREATE TABLE IF NOT EXISTS ifund_migration.owner_link_consent_audit (
  consent_nonce_sha256 text PRIMARY KEY CHECK (consent_nonce_sha256 ~ '^[0-9a-f]{64}$'),
  source_owner_id text NOT NULL REFERENCES ifund_migration.owner_identity_map(source_owner_id) ON DELETE CASCADE,
  destination_auth_uid uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_origin text NOT NULL CHECK (consent_origin IN (
    'https://interplanetaryfund.com', 'https://www.interplanetaryfund.com')),
  consent_version text NOT NULL CHECK (consent_version = 'ifund-owner-link-v1'),
  transition text NOT NULL CHECK (transition IN ('new_link', 'historical_upgrade')),
  source_session_checked_at timestamptz NOT NULL,
  destination_session_checked_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ifund_migration.owner_link_consent_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE ifund_migration.owner_link_consent_audit FROM PUBLIC, anon, authenticated;

-- This is a separate, audited, atomic upgrade for exactly the historical
-- email-candidate rows. It cannot claim a new owner or change a destination UID.
-- No live owner session is available yet: keep dormant until the trusted route
-- verifies the exact Base44 AND Supabase bearers and passes a SHA-256 digest of
-- the owner-confirmed, signed one-time challenge. Replay conflicts roll back
-- BOTH the mapping change and the audit insert in the same SQL transaction.
CREATE OR REPLACE FUNCTION public.ifund_migration_owner_upgrade_historical(
  p_source_owner_id text,
  p_destination_auth_uid uuid,
  p_expected_email text,
  p_consent_nonce_sha256 text,
  p_consent_origin text,
  p_source_session_checked_at timestamptz,
  p_destination_session_checked_at timestamptz
)
RETURNS TABLE(upgraded boolean, source_owner_id text, destination_auth_uid uuid, verification_state text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog
AS $rpc$
DECLARE v_source_owner_id text;
DECLARE v_destination_auth_uid uuid;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
    OR p_consent_nonce_sha256 !~ '^[0-9a-f]{64}$'
    OR p_consent_origin NOT IN ('https://interplanetaryfund.com', 'https://www.interplanetaryfund.com')
    OR p_source_session_checked_at IS NULL OR p_destination_session_checked_at IS NULL
    OR p_source_session_checked_at > now() OR p_destination_session_checked_at > now()
    OR p_source_session_checked_at < now() - interval '60 seconds'
    OR p_destination_session_checked_at < now() - interval '60 seconds'
  THEN RETURN; END IF;

  UPDATE ifund_migration.owner_identity_map AS m
  SET candidate_auth_uid = NULL,
      candidate_match_method = NULL,
      candidate_detected_at = NULL,
      updated_at = now()
  WHERE m.source_owner_id = p_source_owner_id
    AND m.verification_state = 'verified'
    AND m.candidate_match_method = 'confirmed_exact_email'
    AND m.candidate_auth_uid = p_destination_auth_uid
    AND m.destination_auth_uid = p_destination_auth_uid
    AND lower(btrim(m.source_email)) = lower(btrim(p_expected_email))
    AND EXISTS (
      SELECT 1 FROM auth.users AS u
      WHERE u.id = p_destination_auth_uid
        AND u.email_confirmed_at IS NOT NULL
        AND lower(btrim(u.email)) = lower(btrim(p_expected_email))
    )
    AND EXISTS (
      SELECT 1 FROM auth.sessions AS s
      WHERE s.user_id = p_destination_auth_uid
        AND (s.not_after IS NULL OR s.not_after > now())
    )
  RETURNING m.source_owner_id, m.destination_auth_uid
  INTO v_source_owner_id, v_destination_auth_uid;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO ifund_migration.owner_link_consent_audit (
    consent_nonce_sha256, source_owner_id, destination_auth_uid,
    consent_origin, consent_version, transition,
    source_session_checked_at, destination_session_checked_at
  ) VALUES (
    p_consent_nonce_sha256, v_source_owner_id, v_destination_auth_uid,
    p_consent_origin, 'ifund-owner-link-v1', 'historical_upgrade',
    p_source_session_checked_at, p_destination_session_checked_at
  );
  RETURN QUERY SELECT true, v_source_owner_id, v_destination_auth_uid, 'verified'::text;
END;
$rpc$;
REVOKE ALL ON FUNCTION public.ifund_migration_owner_upgrade_historical(text,uuid,text,text,text,timestamptz,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ifund_migration_owner_upgrade_historical(text,uuid,text,text,text,timestamptz,timestamptz) TO service_role;
-- END STAGED OWNER CONSENT AUDIT V1
