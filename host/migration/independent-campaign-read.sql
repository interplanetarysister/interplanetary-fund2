-- IFund independent owner campaign READ preview. SOURCE ONLY: DO NOT APPLY
-- until owner identities are provider-verified and the owner-link route passes
-- real positive tests. No anonymous or service-role read access is granted.
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
   AND lower(btrim(m.source_email)) = lower(btrim(u.email))
  JOIN ifund_migration.campaign_shadow AS c
    ON c.source_owner_id = m.source_owner_id
   AND c.financial_authoritative = false
  WHERE current_setting('request.jwt.claim.role', true) = 'authenticated'
    AND auth.uid() IS NOT NULL
    AND u.id = auth.uid()
    AND u.email_confirmed_at IS NOT NULL
  ORDER BY c.synced_at DESC, c.source_id ASC
  LIMIT 50
$rpc$;

REVOKE ALL ON FUNCTION public.ifund_migration_my_campaigns() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ifund_migration_my_campaigns() TO authenticated;
