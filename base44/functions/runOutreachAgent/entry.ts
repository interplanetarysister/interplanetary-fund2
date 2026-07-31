import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

// Autonomous AI Outreach Agent runner. Invoked on a schedule (no user context),
// so all work is service-scoped. For each campaign opted into the agent whose
// owner holds an active outreach-tier subscription, it analyzes the campaign
// and records recommendations + an activity log entry. Every artifact stays
// truthful and is left for the owner to approve, reject, edit, or pause.

const COMPLIANCE = `Compliance and safety (non-negotiable):
- Never fabricate facts, names, amounts, dates, statistics, or outcomes.
- Only use information provided in the campaign context; omit anything unknown.
- Never create false urgency, promise outcomes, or misrepresent facts.
- Never recommend spamming, harassment, or circumventing platform policies.
- Respect privacy, anti-spam rules, and platform terms.`;

const TIER_LEVEL = { outreach: 2, professional: 3, enterprise: 4, nonprofit: 2 };

function buildContext(campaign, donationsCount, updatesCount) {
  const p = campaign.ai_profile || {};
  const lines = [];
  if (campaign.title) lines.push(`Title: ${campaign.title}`);
  if (campaign.category) lines.push(`Category: ${campaign.category}`);
  if (campaign.summary) lines.push(`Summary: ${campaign.summary}`);
  if (campaign.goal_amount) lines.push(`Goal: $${campaign.goal_amount}`);
  if (campaign.raised_amount != null) lines.push(`Raised: $${campaign.raised_amount || 0} from ${campaign.donor_count || 0} donors`);
  if (donationsCount != null) lines.push(`Recent donations: ${donationsCount}`);
  if (updatesCount != null) lines.push(`Updates posted: ${updatesCount}`);
  if (p.tone) lines.push(`Preferred tone: ${p.tone}`);
  if (p.priority) lines.push(`Priority: ${p.priority}`);
  if (p.always_emphasize) lines.push(`Always emphasize: ${p.always_emphasize}`);
  if (p.never_change) lines.push(`Never change: ${p.never_change}`);
  if (p.avoid_words) lines.push(`Avoid: ${p.avoid_words}`);
  if (p.ideal_donors) lines.push(`Ideal donors: ${p.ideal_donors}`);
  if (p.interested_orgs) lines.push(`Interested orgs/communities: ${p.interested_orgs}`);
  if (p.platforms && p.platforms.length) lines.push(`Sharing platforms: ${p.platforms.join(', ')}`);
  return lines.join('\n') || 'No campaign context available.';
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    const campaigns = await sr.entities.Campaign.filter({ outreach_enabled: true });
    const processed = [];

    for (const campaign of campaigns.slice(0, 5)) {
      if (campaign.outreach_paused) { processed.push({ id: campaign.id, skipped: 'paused' }); continue; }

      const owner = await sr.entities.User.get(campaign.created_by_id).catch(() => null);
      if (!owner || (owner.subscription_status !== 'active' && owner.subscription_status !== 'trialing')) {
        processed.push({ id: campaign.id, skipped: 'no active subscription' });
        continue;
      }
      if ((TIER_LEVEL[owner.subscription_tier] || 0) < 2) {
        processed.push({ id: campaign.id, skipped: 'tier below outreach' });
        continue;
      }

      const donations = await sr.entities.Donation.filter({ campaign_id: campaign.id }, '-created_date', 100);
      const updates = await sr.entities.CampaignUpdate.filter({ campaign_id: campaign.id });
      const context = buildContext(campaign, donations.length, updates.length);

      const prompt = `You are an autonomous fundraising outreach agent working on behalf of a Crowdfund campaign creator. The creator approves every action you propose.
${COMPLIANCE}

Based on the campaign below, produce:
1. Two specific, actionable recommendations to improve outreach and fundraising (truthful, no invented facts).
2. One short outreach message draft (under 120 words, plain text, warm, no placeholders) the creator can send to likely supporters.
3. The single most important next action the creator should take.

Return JSON only matching the schema.

Campaign context:
${context}`;

      const res = await sr.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  expected_impact: { type: 'string' },
                  reasoning: { type: 'string' },
                },
              },
            },
            draft_message: { type: 'string' },
            next_action: { type: 'string' },
          },
        },
      });

      const ownerId = campaign.created_by_id;
      const recIds = [];
      for (const r of (res.recommendations || [])) {
        const rec = await sr.entities.Recommendation.create({
          campaign_id: campaign.id,
          campaign_title: campaign.title,
          owner_user_id: ownerId,
          title: r.title,
          description: r.description,
          expected_impact: r.expected_impact,
          reasoning: r.reasoning,
          agent: 'outreach',
          status: 'open',
        });
        recIds.push(rec.id);
      }

      const nextActions = [
        res.next_action,
        'Review the draft outreach message and approve or edit it before sending to supporters.',
      ].filter(Boolean);

      await sr.entities.AgentActivity.create({
        campaign_id: campaign.id,
        campaign_title: campaign.title,
        owner_user_id: ownerId,
        category: 'outreach',
        action: 'Ran autonomous outreach analysis and generated recommendations plus a draft outreach message.',
        reason: 'Campaign is opted into the AI Outreach Agent; periodic monitoring improves outreach performance.',
        expected_impact: 'Sharper audience targeting and ready-to-send donor messaging.',
        result: `Generated ${recIds.length} recommendation(s) and 1 draft outreach message.`,
        recommended_next_actions: nextActions,
        artifact_type: 'recommendation',
        artifact_id: recIds[0] || undefined,
        status: 'pending',
      });

      processed.push({ id: campaign.id, recommendations: recIds.length });
    }

    return Response.json({ processed });
  } catch (error) {
    console.error('runOutreachAgent error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}