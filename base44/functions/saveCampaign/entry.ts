import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

const ALLOWED = new Set(['title','summary','story','category','goal_amount','status','cover_image_url','end_date','location','location_lat','location_lng','ai_profile','story_versions','draft_step','accept_crypto_donations']);
const STATUSES = new Set(['draft','active','paused','completed']);

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;
    const body = await req.json().catch(() => ({}));
    const campaignId = String(body?.campaign_id || '').trim();
    const input = body?.campaign && typeof body.campaign === 'object' && !Array.isArray(body.campaign) ? body.campaign : null;
    if (!input || Object.keys(input).some((k) => !ALLOWED.has(k))) return Response.json({ error: 'Invalid campaign payload' }, { status: 400 });

    const title = String(input.title || '').trim();
    const goal = input.goal_amount === '' || input.goal_amount == null ? 0 : Number(input.goal_amount);
    const status = String(input.status || 'draft');
    if (!STATUSES.has(status) || !Number.isFinite(goal) || goal < 0 ||
        typeof input.ai_profile !== 'undefined' &&
          (!input.ai_profile || typeof input.ai_profile !== 'object' || Array.isArray(input.ai_profile)) ||
        typeof input.story_versions !== 'undefined' &&
          (!Array.isArray(input.story_versions) || input.story_versions.length > 50) ||
        typeof input.draft_step !== 'undefined' &&
          (!Number.isInteger(input.draft_step) || input.draft_step < 0 || input.draft_step > 3))
      return Response.json({ error: 'Invalid campaign information' }, { status: 400 });
    if (status !== 'draft' && (!title || goal <= 0 || !String(input.story || input.summary || '').trim()))
      return Response.json({ error: 'Add a campaign title, funding goal, and story before publishing.' }, { status: 400 });

    // Blank title and zero goal are valid PRIVATE drafts, not published campaigns.
    // Persist AI instructions/story versions and wizard position along with the
    // visible fields so saving early never discards another step's work.
    const safe = { ...input, title, goal_amount: goal, status };
    if ('accept_crypto_donations' in safe) safe.accept_crypto_donations = safe.accept_crypto_donations === true;
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