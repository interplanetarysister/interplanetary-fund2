import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { emitActivityEvent } from '../../shared/activityEvent.ts';
import { ensureCanonicalCampaign } from '../../shared/convexFinancial.ts';

const MAX_CAMPAIGN_ID = 128;
const SAFE_ID = /^[A-Za-z0-9_-]+$/;

function diagnosticType(value) {
  if (value instanceof Error) return 'error';
  if (value === null) return 'null';
  if (typeof value === 'string') return 'string';
  return typeof value;
}

function jsonError(error, status, headers = {}) {
  return Response.json({ error }, { status, headers });
}

// Publishes a campaign into the Community feed and registers its stable
// application identity with the canonical Convex backend. Financial writes
// fail closed unless this mapping exists, so registration happens before the
// public campaign-created event.
export default async function(req) {
  if (req?.method !== 'POST') {
    return jsonError('Method not allowed.', 405, { Allow: 'POST' });
  }

  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    let user = null;
    try { user = await base44.auth.me(); } catch (_) { /* not signed in */ }
    if (!user) return jsonError('Sign in required', 401);

    const body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonError('Campaign is required', 400);
    }
    const keys = Object.keys(body);
    if (keys.some((key) => key !== 'campaign_id')) {
      return jsonError('Campaign is required', 400);
    }
    if (typeof body.campaign_id !== 'string') {
      return jsonError('Campaign is required', 400);
    }
    const campaign_id = body.campaign_id.trim();
    if (!campaign_id || campaign_id.length > MAX_CAMPAIGN_ID || !SAFE_ID.test(campaign_id)) {
      return jsonError('Campaign is required', 400);
    }

    let campaign;
    try {
      campaign = await sr.entities.Campaign.get(campaign_id);
    } catch (dependencyError) {
      console.error('recordCampaignCreated campaign lookup failure:', diagnosticType(dependencyError));
      return jsonError('Unable to load campaign.', 503);
    }
    if (!campaign) return jsonError('Campaign not found', 404);
    if (campaign.created_by_id !== user.id && user.role !== 'admin') {
      return jsonError('Only the campaign owner can publish this event.', 403);
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
    console.error('recordCampaignCreated error:', diagnosticType(error));
    return jsonError('Unable to publish campaign because the canonical backend could not be updated.', 503);
  }
}
