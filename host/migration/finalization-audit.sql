-- IFund finalization audit: read-only, aggregate-only, no secrets or user identities.
-- Run with a trusted Supabase SQL session. Never expose private staging to browser roles.
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
