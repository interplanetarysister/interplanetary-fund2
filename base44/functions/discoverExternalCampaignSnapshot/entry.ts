import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { discoverPublicCampaignSnapshot } from './publicCampaignSnapshot.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const connection = await base44.entities.PlatformConnection.get(body.connection_id).catch(() => null);
    if (!connection || connection.created_by_id !== user.id || connection.kind !== 'crowdfunding') {
      return Response.json({ error: 'Connected fundraiser not found.' }, { status: 404 });
    }

    const snapshot = await discoverPublicCampaignSnapshot(connection);
    return Response.json({ ok: true, ...snapshot });
  } catch (error) {
    console.error('discoverExternalCampaignSnapshot failed:', error?.name || 'UnknownError');
    return Response.json({ error: 'The external campaign could not be discovered safely.' }, { status: 500 });
  }
}
