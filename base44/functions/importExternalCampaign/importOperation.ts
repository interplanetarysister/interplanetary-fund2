import { ExternalSyncRequestError } from '../../shared/externalSyncRequest.ts';

const ALLOWED = ['title','summary','story','category','goal_amount','cover_image_url','end_date','location'];

const rows = async (entity, filter, limit = 3) => {
  const found = await entity.filter(filter, '-created_date', limit);
  return Array.isArray(found) ? found : [];
};

const ambiguous = (message) =>
  new ExternalSyncRequestError('backend_unavailable', message, 503);

export async function externalCampaignImportTargetKey(ownerUserId, connectionId) {
  const input = new TextEncoder().encode(
    `campaign_import:v1:${String(ownerUserId)}:${String(connectionId)}`,
  );
  const digest = await crypto.subtle.digest('SHA-256', input);
  const encoded = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `campaign_import:v1:${encoded}`;
}

export async function convergeExternalCampaignImport({
  base44,
  sr,
  user,
  connection,
  incoming,
  requestId,
  discover,
}) {
  const targetKey = await externalCampaignImportTargetKey(user.id, connection.id);
  const importFilter = { owner_user_id: user.id, connection_id: connection.id };
  const campaignFilter = { external_import_operation_key: targetKey };

  let [imports, campaigns] = await Promise.all([
    rows(sr.entities.ExternalCampaignImport, importFilter),
    rows(sr.entities.Campaign, campaignFilter),
  ]);
  if (imports.length > 1 || campaigns.length > 1) {
    throw ambiguous('External campaign import state is ambiguous.');
  }

  let imported = imports[0] || null;
  let campaign = campaigns[0] || null;
  const recovered = Boolean(imported || campaign);

  if (imported) {
    const linked = await sr.entities.Campaign.get(imported.campaign_id);
    if (!linked || linked.created_by_id !== user.id ||
        (imported.operation_key && imported.operation_key !== targetKey) ||
        (campaign && campaign.id !== linked.id)) {
      throw ambiguous('External campaign import ownership could not be verified.');
    }
    campaign = linked;
  } else if (campaign && campaign.created_by_id !== user.id) {
    throw ambiguous('External campaign import ownership could not be verified.');
  }

  if (!campaign) {
    const snapshot = await discover(connection);
    const importedAt = new Date().toISOString();
    const payload = {
      ...snapshot.campaign,
      status: 'draft',
      goal_amount: Number(incoming.goal_amount),
      external_import_operation_key: targetKey,
      external_import_connection_id: connection.id,
      external_import_source_url: snapshot.source_url,
      external_import_source_type: snapshot.source,
      external_imported_at: importedAt,
    };
    const created = await base44.entities.Campaign.create(payload);
    campaigns = await rows(sr.entities.Campaign, campaignFilter);
    if (campaigns.length !== 1 ||
        campaigns[0].id !== created.id ||
        campaigns[0].created_by_id !== user.id ||
        campaigns[0].external_import_connection_id !== connection.id) {
      throw ambiguous('Created campaign recovery identity could not be verified.');
    }
    campaign = campaigns[0];
  }

  if (!imported) {
    imports = await rows(sr.entities.ExternalCampaignImport, importFilter);
    if (imports.length > 1) {
      throw ambiguous('External campaign import state is ambiguous.');
    }
    imported = imports[0] || null;
  }

  if (!imported) {
    const importedAt = campaign.external_imported_at || new Date().toISOString();
    const source = campaign.external_import_source_type || 'provider_public_campaign_page';
    const provenance = {};
    for (const key of ALLOWED) {
      if (campaign[key] === undefined) continue;
      provenance[key] = {
        source: key === 'goal_amount'
          ? 'owner_supplied'
          : key === 'category'
            ? 'system_default'
            : source,
        connection_id: connection.id,
        imported_at: importedAt,
        source_value: campaign[key],
      };
    }
    const created = await base44.entities.ExternalCampaignImport.create({
      owner_user_id: user.id,
      connection_id: connection.id,
      operation_key: targetKey,
      request_id: requestId,
      platform: connection.platform,
      external_campaign_id: String(incoming.external_campaign_id || ''),
      external_url: campaign.external_import_source_url || '',
      campaign_id: campaign.id,
      sync_enabled: false,
      last_imported_at: importedAt,
      field_provenance: provenance,
      locally_locked_fields: [],
      status: 'imported',
    });
    imports = await rows(sr.entities.ExternalCampaignImport, importFilter);
    if (imports.length !== 1 ||
        imports[0].id !== created.id ||
        imports[0].campaign_id !== campaign.id ||
        imports[0].operation_key !== targetKey) {
      throw ambiguous('External campaign import record could not be verified.');
    }
    imported = imports[0];
  } else if (imported.campaign_id !== campaign.id) {
    throw ambiguous('External campaign import points to a different campaign.');
  }

  if (connection.campaign_id !== campaign.id) {
    await sr.entities.PlatformConnection.update(connection.id, { campaign_id: campaign.id });
  }
  const verifiedConnection = await sr.entities.PlatformConnection.get(connection.id);
  if (!verifiedConnection || verifiedConnection.created_by_id !== user.id ||
      verifiedConnection.campaign_id !== campaign.id) {
    throw ambiguous('Connected fundraiser campaign link could not be verified.');
  }

  return {
    targetKey,
    recovered,
    campaign,
    imported,
    result: {
      ok: true,
      duplicate: recovered,
      request_id: requestId,
      campaign_id: campaign.id,
      campaign,
      import_record: imported,
    },
  };
}
