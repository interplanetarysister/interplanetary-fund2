import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const WIX_BULK_SAVE = 'https://www.wixapis.com/wix-data/v2/bulk/items/save';
const COLLECTIONS = {
  campaigns: 'ifund_campaign_public',
  updates: 'ifund_public_updates',
  state: 'ifund_integration_state',
};

const text = (value: unknown, max = 4000) => String(value ?? '').slice(0, max);
const PUBLIC_CAMPAIGN_STATUSES = new Set(['active', 'published', 'funded', 'completed']);
const publicCampaignUrl = (id: unknown) =>
  `https://interplanetaryfund.com/Campaign?id=${encodeURIComponent(String(id ?? ''))}`;
const slugify = (value: unknown) => text(value, 120)
  .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function wixBulkSave(token: string, collection: string, dataItems: any[]) {
  if (!dataItems.length) return { totalSuccesses: 0, totalFailures: 0 };
  let totalSuccesses = 0;
  let totalFailures = 0;
  for (let i = 0; i < dataItems.length; i += 500) {
    const res = await fetch(WIX_BULK_SAVE, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dataCollectionId: collection,
        dataItems: dataItems.slice(i, i + 500),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Wix ${collection} sync failed (${res.status})`);
    totalSuccesses += Number(body?.bulkActionMetadata?.totalSuccesses || 0);
    totalFailures += Number(body?.bulkActionMetadata?.totalFailures || 0);
  }
  return { totalSuccesses, totalFailures };
}

export default async function(req: Request) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required.' }, { status: 403 });

    const sr = base44.asServiceRole;
    const wix = await sr.connectors.getConnection('wix').catch(() => null);
    if (!wix?.accessToken) {
      return Response.json({ error: 'Wix needs to be connected before synchronization can run.' }, { status: 409 });
    }

    const startedAt = new Date().toISOString();
    const campaigns = await sr.entities.Campaign.list('-updated_date', 500).catch(() => []);
    const publicCampaigns = campaigns.filter((campaign: any) => PUBLIC_CAMPAIGN_STATUSES.has(String(campaign.status || '').toLowerCase()));
    const publicIds = new Set(publicCampaigns.map((campaign: any) => campaign.id));

    const campaignItems = publicCampaigns.map((campaign: any) => ({
      id: campaign.id,
      data: {
        ifundCampaignId: campaign.id,
        title: text(campaign.title, 500),
        slug: slugify(campaign.title) || campaign.id,
        summary: text(campaign.summary || campaign.story, 4000),
        campaignUrl: publicCampaignUrl(campaign.id),
        status: text(campaign.status || 'active', 40),
        lastSyncedAt: startedAt,
      },
    }));

    const allUpdates = await sr.entities.CampaignUpdate.list('-created_date', 1000).catch(() => []);
    const updateItems = allUpdates
      .filter((update: any) => publicIds.has(update.campaign_id))
      .map((update: any) => ({
        id: update.id,
        data: {
          ifundCampaignId: update.campaign_id,
          title: text(update.title || 'Campaign update', 500),
          body: text(update.content, 12000),
          sourceUrl: publicCampaignUrl(update.campaign_id),
          publishedAt: update.created_date || update.updated_date || startedAt,
        },
      }));

    const connections = await sr.entities.PlatformConnection.list('-updated_date', 1000).catch(() => []);
    const stateItems = connections.map((connection: any) => ({
      id: connection.id,
      data: {
        provider: text(connection.platform, 100),
        externalId: connection.id,
        status: connection.status === 'connected' && connection.verification_status === 'verified'
          ? 'working'
          : connection.status === 'error' ? 'needs_attention' : 'disconnected',
        lastSuccessAt: connection.last_synced || '',
        lastErrorCode: connection.last_error ? 'connection_error' : '',
        notes: text(connection.last_error || connection.description || '', 1000),
      },
    }));

    const results: any = {};
    try {
      results.campaigns = await wixBulkSave(wix.accessToken, COLLECTIONS.campaigns, campaignItems);
      results.updates = await wixBulkSave(wix.accessToken, COLLECTIONS.updates, updateItems);
      results.connections = await wixBulkSave(wix.accessToken, COLLECTIONS.state, stateItems);

      const selfState = [{
        id: 'ifund-wix-sync',
        data: {
          provider: 'wix',
          externalId: 'ifund-wix-sync',
          status: 'working',
          lastSuccessAt: new Date().toISOString(),
          lastErrorCode: '',
          notes: `Base44 → Wix mirror healthy: ${campaignItems.length} campaigns, ${updateItems.length} updates, ${stateItems.length} connection states.`,
        },
      }];
      results.health = await wixBulkSave(wix.accessToken, COLLECTIONS.state, selfState);
    } catch (error) {
      const message = 'Synchronization failed; review IFund server logs for the provider diagnostic.';
      await wixBulkSave(wix.accessToken, COLLECTIONS.state, [{
        id: 'ifund-wix-sync',
        data: {
          provider: 'wix',
          externalId: 'ifund-wix-sync',
          status: 'needs_attention',
          lastSuccessAt: '',
          lastErrorCode: 'sync_failed',
          notes: message,
        },
      }]).catch(() => {});
      throw error;
    }

    return Response.json({
      working: true,
      synced_at: new Date().toISOString(),
      counts: {
        campaigns: campaignItems.length,
        updates: updateItems.length,
        connections: stateItems.length,
      },
      results,
      authority: {
        campaigns: 'ifund',
        finances: 'ifund',
        wix_role: 'publishing_crm_marketing_analytics_operations',
      },
    });
  } catch (error) {
    console.error('syncWixMissionControl error:', (error as any)?.message || error);
    return Response.json({ error: 'Wix synchronization failed.' }, { status: 500 });
  }
}
