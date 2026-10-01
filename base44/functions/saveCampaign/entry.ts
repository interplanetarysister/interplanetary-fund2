import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const ALLOWED = new Set(['title','summary','story','category','goal_amount','status','cover_image_url','end_date','location','location_lat','location_lng','ai_profile','story_versions']);
const STATUSES = new Set(['draft','active','paused','completed']);

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const campaignId = String(body?.campaign_id || '').trim();
    const input = body?.campaign && typeof body.campaign === 'object' && !Array.isArray(body.campaign) ? body.campaign : null;
    if (!input || Object.keys(input).some((k) => !ALLOWED.has(k))) return Response.json({ error: 'Invalid campaign payload' }, { status: 400 });

    const title = String(input.title || '').trim();
    const goal = Number(input.goal_amount);
    const status = String(input.status || 'draft');
    if (!title || !Number.isFinite(goal) || goal <= 0 || !STATUSES.has(status)) return Response.json({ error: 'Campaign title, goal, or status is invalid' }, { status: 400 });
    if (status === 'active' && !String(input.story || input.summary || '').trim()) return Response.json({ error: 'Campaign story is required to launch' }, { status: 400 });

    const safe = { ...input, title, goal_amount: goal, status };
    if (campaignId) {
      const rows = await base44.asServiceRole.entities.Campaign.filter({ id: campaignId });
      const existing = rows?.[0];
      if (!existing) return Response.json({ error: 'Campaign not found' }, { status: 404 });
      if (existing.created_by_id !== user.id && user.role !== 'admin') return Response.json({ error: 'Not authorized' }, { status: 403 });
      await base44.asServiceRole.entities.Campaign.update(campaignId, safe);
      return Response.json({ ok: true, campaign: { ...existing, ...safe, id: campaignId }, created: false });
    }

    const created = await base44.entities.Campaign.create(safe);
    return Response.json({ ok: true, campaign: created, created: true });
  } catch (error) {
    console.error('saveCampaign failed:', error?.name || 'UnknownError');
    return Response.json({ error: 'Campaign could not be saved safely.' }, { status: 500 });
  }
}
