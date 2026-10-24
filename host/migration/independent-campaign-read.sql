-- IFund independent owner campaign READ preview. SOURCE ONLY: DO NOT APPLY
-- until durable two-provider owner-session consent, positive owner HTTP and
-- negative cross-owner HTTP access tests are independently verified.
-- Current email-only owner mappings are NOT proof of live source authentication.
-- No authenticated EXECUTE grant is permitted in this dormant source file.
-- Requires existing private ifund_migration.campaign_shadow and
-- ifund_migration.owner_identity_map. No donations, payouts, or ledger fields.
-- Rollback after eventual activation:
-- DROP FUNCTION IF EXISTS public.ifund_migration_my_campaigns();

CREATE OR REPLACE FUNCTION public.ifund_migration_my_campaigns()
RETURNS TABLE (
  owner_auth_uid uuid,
  source_id text,
  title text,
  summary text,
  story text,
  status text,
  category text,
  goal_amount numeric,
  cover_image_url text,
  end_date date,
  location text,
  source_updated_at text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $rpc$
  SELECT u.id, c.source_id, c.title, c.summary, c.story, c.status,
         c.category, c.goal_amount, c.cover_image_url, c.end_date,
         c.location, c.source_updated_at
  FROM auth.users AS u
  JOIN ifund_migration.owner_identity_map AS m
    ON m.destination_auth_uid = u.id
   AND m.verification_state = 'verified'
   AND m.candidate_match_method IS NULL
   AND lower(btrim(m.source_email)) = lower(btrim(u.email))
  JOIN ifund_migration.campaign_shadow AS c
    ON c.source_owner_id = m.source_owner_id
   AND c.financial_authoritative = false
  WHERE current_setting('request.jwt.claim.role', true) = 'authenticated'
    AND auth.uid() IS NOT NULL
    AND u.id = auth.uid()
    AND u.email_confirmed_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM auth.sessions AS s
      WHERE s.user_id = u.id
        AND s.id::text = auth.jwt()->>'session_id'
        AND (s.not_after IS NULL OR s.not_after > now())
    )
  ORDER BY c.synced_at DESC, c.source_id ASC
  LIMIT 50
$rpc$;

-- Only the server's dual-provider consent bridge can establish a verified
-- owner link without an email-only candidate match method. This predicate
-- excludes ALL pre-linked confirmed_exact_email candidates, even if someone
-- mistakenly grants authenticated EXECUTE before durable proof is available.
-- A null candidate method is NOT itself proof of consent; the separate
-- owner-session, durable consent and cross-owner HTTP gates remain mandatory.
-- Require a destination JWT tied to a currently recorded, non-expired
-- Supabase auth.sessions row; email confirmation alone cannot satisfy this.
REVOKE ALL ON FUNCTION public.ifund_migration_my_campaigns() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ifund_migration_my_campaigns() TO service_role;
-- Deliberate future release ONLY after owner proof and cross-owner HTTP tests:
-- GRANT EXECUTE ON FUNCTION public.ifund_migration_my_campaigns() TO authenticated;
-- Emergency permission rollback after release:
-- REVOKE EXECUTE ON FUNCTION public.ifund_migration_my_campaigns() FROM authenticated;
