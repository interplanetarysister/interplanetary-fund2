import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Campaign Protocol enforcement — invoked by the "Campaign Protocol" entity
// workflow whenever a Campaign is created or updated. It:
//   1. forces outreach_enabled = true (Michelle's directive: all campaigns),
//   2. reverts any campaign launched as "active" that is missing required
//      fields back to "draft" so incomplete campaigns can never go live,
//   3. validates ai_profile completeness (tone, ideal_donors, interested_orgs,
//      platforms),
//   4. opens a single follow-up Recommendation for any incomplete campaign.
// Idempotent + deduped so the entity trigger can't loop.
const ACTIVE_REQUIRED = ['title', 'summary', 'story', 'category', 'cover_image_url', 'end_date'];
const AI_PROFILE_REQUIRED = ['tone', 'ideal_donors', 'interested_orgs', 'platforms'];
const FLAG_TITLE = 'Campaign Protocol — action needed';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const campaign_id = body?.campaign_id || body?.id;
    if (!campaign_id) return Response.json({ error: 'campaign_id is required' }, { status: 400 });

    const c = await sr.entities.Campaign.get(campaign_id).catch(() => null);
    if (!c) return Response.json({ error: 'Campaign not found' }, { status: 404 });

    const updates = {};
    const issues = [];

    // 1. outreach default on
    if (!c.outreach_enabled) updates.outreach_enabled = true;

    // 2. active-status gate
    if (c.status === 'active') {
      const missing = ACTIVE_REQUIRED.filter((f) => {
        const v = c[f];
        return v == null || (typeof v === 'string' && v.trim() === '');
      });
      if (!(c.goal_amount > 0) && !missing.includes('goal_amount')) missing.push('goal_amount');
      if (missing.length) {
        updates.status = 'draft';
        issues.push(`Reverted to draft — missing required fields for active status: ${missing.join(', ')}.`);
      }
    }

    // 3. ai_profile completeness
    const p = c.ai_profile || {};
    const aiMissing = AI_PROFILE_REQUIRED.filter((f) => {
      if (f === 'platforms') return !Array.isArray(p.platforms) || p.platforms.length === 0;
      const v = p[f];
      return v == null || (typeof v === 'string' && v.trim() === '');
    });
    if (aiMissing.length) issues.push(`AI profile incomplete: ${aiMissing.join(', ')}.`);

    if (Object.keys(updates).length) {
      await sr.entities.Campaign.update(campaign_id, updates);
    }

    // 4. one deduped follow-up recommendation
    if (issues.length) {
      const existing = await sr.entities.Recommendation.filter({
        campaign_id,
        title: FLAG_TITLE,
        status: 'open',
      }).catch(() => []);
      if (!existing.length) {
        await sr.entities.Recommendation.create({
          campaign_id,
          campaign_title: c.title || 'Untitled campaign',
          owner_user_id: c.created_by_id,
          title: FLAG_TITLE,
          description: issues.join('\n'),
          reasoning: "Michelle's Campaign Protocol requires every campaign to be complete and AI-profiled before going live.",
          agent: 'strategy',
          status: 'open',
          confidence: 'high',
          expected_impact: 'Campaign becomes compliant and ready to attract donors.',
          estimated_effort: 'A few minutes',
        }).catch(() => {});
      }
    }

    return Response.json({ ok: true, updated: Object.keys(updates), issues });
  } catch (error) {
    console.error('enforceCampaignProtocol error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}