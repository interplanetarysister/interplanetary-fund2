import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { emitActivityEvent } from '../../shared/activityEvent.ts';
import { ensureCanonicalCampaign } from '../../shared/convexFinancial.ts';

// Publishes a campaign into the Community feed and registers its stable
// application identity with the canonical Convex backend. Financial writes
// fail closed unless this mapping exists, so registration happens before the
// public campaign-created event.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    let user = null;
    try { user = await base44.auth.me(); } catch (_) { /* not signed in */ }
    if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 });

    const { campaign_id } = await req.json();
    if (!campaign_id) return Response.json({ error: 'Campaign is required' }, { status: 400 });

    const campaign = await sr.entities.Campaign.get(campaign_id).catch(() => null);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.created_by_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the campaign owner can publish this event.' }, { status: 403 });
    }
    if (campaign.status !== 'active') {
      return Response.json({ ok: true, skipped: true });
    }

    // Do not silently publish an active campaign that cannot participate in
    // canonical financial accounting. This upsert never trusts the application
    // for raised/donor totals; Convex preserves its own financial values.
    await ensureCanonicalCampaign(sr, campaign);

    const creator = await sr.entities.User.get(campaign.created_by_id).catch(() => null);
    await emitActivityEvent(base44, {
      type: 'campaign_created',
      actor_user_id: campaign.created_by_id,
      actor_display_name: (creator && creator.full_name) || 'An organizer',
      actor_handle: (creator && creator.handle) || undefined,
      actor_image_url: (creator && creator.profile_image_url) || undefined,
      campaign_id: campaign.id,
      campaign_title: campaign.title,
      campaign_image_url: campaign.cover_image_url || undefined,
      body: `New campaign: ${campaign.title}`,
      link: `/campaign/${campaign.id}`,
      visibility: 'public',
      metadata: { category: campaign.category, goal_amount: campaign.goal_amount },
    });

    return Response.json({ ok: true, canonical_registered: true });
  } catch (error) {
    console.error('recordCampaignCreated error:', error && error.message ? error.message : error);
    return Response.json({ error: 'Unable to publish campaign because the canonical backend could not be updated.' }, { status: 503 });
  }
}
