-- IFund finalization audit: read-only, aggregate-only, no secrets or user identities.
-- Run only with a trusted Supabase SQL session. Never expose private staging to browser roles.
-- Prerequisites not defined in this repository:
--   ifund_migration.owner_identity_map (verification_state)
--   ifund_migration.campaign_shadow
--   ifund_migration.source_records (entity_type)
--   ifund_migration.agent_activity_shadow
--   ifund_migration.agent_delegation_shadow
-- Only ifund_migration.content_shadow is defined here, by ifund-content-shadow.sql.
-- The other relations/columns are expected from an existing private staging setup outside this repo;
-- their provenance and presence in the intended target database have NOT been verified here.
-- Check the exact target schema before running. This file does not create or repair any relation.
-- If any prerequisite relation or column is absent, the entire UNION query fails at parse time.
select 'owner_verified' as metric, count(*)::bigint as value
from ifund_migration.owner_identity_map where verification_state = 'verified'
union all
select 'owner_unverified', count(*)::bigint
from ifund_migration.owner_identity_map where verification_state <> 'verified'
union all
select 'campaigns_staged', count(*)::bigint from ifund_migration.campaign_shadow
union all
select 'content_staged', count(*)::bigint from ifund_migration.content_shadow
union all
select 'platform_connections_staged', count(*)::bigint
from ifund_migration.source_records where entity_type = 'PlatformConnection'
union all
select 'campaign_updates_staged', count(*)::bigint
from ifund_migration.source_records where entity_type = 'CampaignUpdate'
union all
select 'agent_activities_staged', count(*)::bigint from ifund_migration.agent_activity_shadow
union all
select 'agent_delegations_staged', count(*)::bigint from ifund_migration.agent_delegation_shadow;
