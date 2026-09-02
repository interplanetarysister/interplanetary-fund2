import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { emitActivityEvent } from '../../shared/activityEvent.ts';

// Emits a 'campaign_created' ActivityEvent into the Community feed. Called
// by the Create Campaign flow after a campaign is published (status 'active').
// Drafts are skipped — they aren't public and shouldn't appear in the feed.
// Only the campaign owner (or an admin) may publish this event; the function
// verifies ownership server-side rather than trusting the client.
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

    const creator = await sr.entities.User.get(campaign.created_by_id).catch(() => null);
    await emitActivityEvent(base44, {
      type: 'campaign_created',
      actor_user_id: campaign.created_by_id,
      actor_display_name: (creator && creator.full_name) || 'A organizer',
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

    return Response.json({ ok: true });
  } catch (error) {
    console.error('recordCampaignCreated error:', error && error.message ? error.message : error);
    return Response.json({ error: 'Unable to publish campaign event.' }, { status: 500 });
  }
}