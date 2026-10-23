-- IFund private migration: service-only, read-only ACTIVE campaign preview.
-- Deliberately NOT a public campaign API or authoritative live campaign store.
-- Uses existing private campaign_shadow snapshots. Does not expose owners,
-- drafts, donation/payout totals, crypto/payment details or private narratives.
-- Must not be wired to a public route until privacy and parity are verified.
-- Rollback: DROP FUNCTION public.ifund_migration_active_campaign_preview(text,integer);

CREATE OR REPLACE FUNCTION public.ifund_migration_active_campaign_preview(
  p_after_source_id text DEFAULT NULL,
  p_limit integer DEFAULT 24
)
RETURNS TABLE (
  source_id text,
  title text,
  summary text,
  category text,
  cover_image_url text,
  preview_only boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $rpc$
  SELECT c.source_id, c.title, c.summary, c.category,
         c.cover_image_url, true AS preview_only
  FROM ifund_migration.campaign_shadow AS c
  WHERE current_setting('request.jwt.claim.role', true) = 'service_role'
    AND c.status = 'active'
    AND c.financial_authoritative IS FALSE
    AND (p_after_source_id IS NULL OR c.source_id > p_after_source_id)
    AND (p_after_source_id IS NULL OR length(p_after_source_id) <= 128)
  ORDER BY c.source_id ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 24), 1), 50)
$rpc$;

REVOKE ALL ON FUNCTION public.ifund_migration_active_campaign_preview(text,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ifund_migration_active_campaign_preview(text,integer)
  TO service_role;
