import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const CASHTAG = /^[A-Za-z0-9_]{1,20}$/;
const ALLOWED = new Set(['cashapp_tag','outreach_enabled','outreach_paused','ai_profile']);

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const campaignId = String(body?.campaign_id || '').trim();
    const patch = body?.patch && typeof body.patch === 'object' && !Array.isArray(body.patch) ? body.patch : null;
    if (!campaignId || !patch) return Response.json({ error: 'Invalid request' }, { status: 400 });

    const keys = Object.keys(patch);
    if (!keys.length || keys.some((key) => !ALLOWED.has(key))) {
      return Response.json({ error: 'Unsupported campaign setting' }, { status: 400 });
    }

    const rows = await base44.asServiceRole.entities.Campaign.filter({ id: campaignId });
    const campaign = rows?.[0];
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.created_by_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Not authorized' }, { status: 403 });
    }

    const safe = {};
    if ('cashapp_tag' in patch) {
      const tag = String(patch.cashapp_tag || '').replace(/^\$/, '').trim();
      if (tag && !CASHTAG.test(tag)) return Response.json({ error: 'Invalid Cashtag' }, { status: 400 });
      safe.cashapp_tag = tag;
    }
    if ('outreach_enabled' in patch) safe.outreach_enabled = patch.outreach_enabled === true;
    if ('outreach_paused' in patch) safe.outreach_paused = patch.outreach_paused === true;
    if ('ai_profile' in patch) {
      if (!patch.ai_profile || typeof patch.ai_profile !== 'object' || Array.isArray(patch.ai_profile)) {
        return Response.json({ error: 'Invalid AI profile' }, { status: 400 });
      }
      safe.ai_profile = patch.ai_profile;
    }

    await base44.asServiceRole.entities.Campaign.update(campaignId, safe);
    return Response.json({ ok: true, campaign_id: campaignId, updated: Object.keys(safe) });
  } catch (error) {
    console.error('updateCampaignSettings failed:', error?.name || 'UnknownError');
    return Response.json({ error: 'Campaign settings could not be updated safely.' }, { status: 500 });
  }
}
