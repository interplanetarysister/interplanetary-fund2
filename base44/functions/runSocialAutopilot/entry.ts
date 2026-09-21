import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { checkRateLimit } from '../../shared/rateLimit.ts';
import { canAutoPublish, hasAiPublishingConsent } from '../../shared/socialPublish.ts';
import { assertOboGrant, assertPlatformAccess } from '../../shared/integrationRegistry.ts';

// Autonomous Social Media Autopilot (invoked by the "Social Media Autopilot"
// workflow, no user context — service-scoped like runOutreachAgent):
// For each active, opted-in campaign whose owner granted AI publishing consent,
// it generates one truthful cross-platform post and stages it on the owner's
// connected social destinations — auto connections get it scheduled for the
// Connection Sync Engine to publish, ask/draft connections get it staged for
// the owner to approve. Max one generated post per campaign per week, and
// every artifact is recorded in AgentActivity for the owner.

const COMPLIANCE = `Compliance and safety (non-negotiable):
- Never fabricate facts, names, amounts, dates, statistics, or outcomes.
- Only use information provided in the campaign context; omit anything unknown.
- Never create false urgency, promise outcomes, or misrepresent facts.
- Respect privacy, anti-spam rules, and platform terms.`;

const WEEK_SECONDS = 7 * 24 * 60 * 60;

function buildContext(campaign) {
  const p = campaign.ai_profile || {};
  const lines = [];
  if (campaign.title) lines.push(`Title: ${campaign.title}`);
  if (campaign.category) lines.push(`Category: ${campaign.category}`);
  if (campaign.summary) lines.push(`Summary: ${campaign.summary}`);
  if (campaign.goal_amount) lines.push(`Goal: $${campaign.goal_amount}`);
  if (campaign.raised_amount != null) lines.push(`Raised: $${campaign.raised_amount || 0} from ${campaign.donor_count || 0} donors`);
  if (p.tone) lines.push(`Preferred tone: ${p.tone}`);
  if (p.priority) lines.push(`Priority: ${p.priority}`);
  if (p.always_emphasize) lines.push(`Always emphasize: ${p.always_emphasize}`);
  if (p.never_change) lines.push(`Never change: ${p.never_change}`);
  if (p.avoid_words) lines.push(`Avoid: ${p.avoid_words}`);
  if (p.ideal_donors) lines.push(`Ideal donors: ${p.ideal_donors}`);
  if (p.platforms && p.platforms.length) lines.push(`Sharing platforms: ${p.platforms.join(', ')}`);
  return lines.join('\n') || 'No campaign context available.';
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const report = { campaigns_processed: 0, posts_staged: 0, skipped: [] };

    // Centralized access gate: if social publishing is revoked/disabled at the
    // registry level, the autopilot stages nothing this run.
    const access = await assertPlatformAccess(sr, 'social_publish');
    if (!access.ok) {
      return Response.json({ skipped_all: access.reason, ...report });
    }

    // Eligible destinations: connected social connections with automation on.
    const connections = await sr.entities.PlatformConnection.filter({ kind: 'social', status: 'connected' }, '-updated_date', 200);
    const activeConnections = connections.filter((c) => ['auto', 'ask', 'draft'].includes(c.automation_mode));
    if (!activeConnections.length) {
      return Response.json({ skipped_all: 'no automated social connections', ...report });
    }

    const campaigns = await sr.entities.Campaign.filter({ status: 'active', outreach_enabled: true }, '-updated_date', 50);

    for (const campaign of campaigns) {
      if (report.campaigns_processed >= 5) break;
      if (campaign.outreach_paused) { report.skipped.push({ id: campaign.id, reason: 'paused' }); continue; }

      const owner = await sr.entities.User.get(campaign.created_by_id).catch(() => null);
      if (!owner || owner.account_deletion_pending || (owner.account_status && owner.account_status !== 'active')) {
        report.skipped.push({ id: campaign.id, reason: 'owner account unavailable' });
        continue;
      }
      if (!hasAiPublishingConsent(owner)) {
        report.skipped.push({ id: campaign.id, reason: 'no AI publishing consent' });
        continue;
      }
      const obo = await assertOboGrant(sr, 'platform_outreach_agent', campaign.created_by_id, 'social_publish');
      if (!obo.ok) {
        report.skipped.push({ id: campaign.id, reason: obo.reason });
        continue;
      }
      const targets = activeConnections.filter((c) =>
        c.created_by_id === campaign.created_by_id &&
        (!c.campaign_id || c.campaign_id === campaign.id)
      );
      if (!targets.length) {
        report.skipped.push({ id: campaign.id, reason: 'no matching social connections' });
        continue;
      }

      // Cadence guard: at most one generated post per campaign per week.
      const rate = await checkRateLimit(base44, `socialAutopilot:${campaign.id}`, 1, WEEK_SECONDS);
      if (!rate.allowed) {
        report.skipped.push({ id: campaign.id, reason: 'weekly cadence reached' });
        continue;
      }

      const res = await sr.integrations.Core.InvokeLLM({
        prompt: `You are the autonomous social media manager for an Interplanetary Fund campaign, acting on behalf of the campaign creator. The creator approved automated social posting for this campaign.
${COMPLIANCE}

Write one social media post promoting this campaign. It should be under 280 characters, plain text, warm and inspiring, include a clear call to support, and no hashtags (a platform-tailored hashtag set is added separately). Use only facts from the context below.

Campaign context:
${buildContext(campaign)}

Return JSON only matching the schema.`,
        response_json_schema: {
          type: 'object',
          properties: {
            post_text: { type: 'string' },
            hashtags: { type: 'array', items: { type: 'string' } },
          },
        },
      });

      const content = (res.post_text || '').trim();
      if (!content) {
        report.skipped.push({ id: campaign.id, reason: 'empty generation' });
        continue;
      }
      const hashtags = (res.hashtags || []).slice(0, 4);
      const nowIso = new Date().toISOString();
      let staged = 0;

      for (const connection of targets) {
        const status =
          connection.automation_mode === 'auto' && canAutoPublish(connection) ? 'scheduled' :
          connection.automation_mode === 'ask' ? 'pending_approval' : 'draft';
        await sr.entities.DistributedPost.create({
          campaign_id: campaign.id,
          campaign_title: campaign.title,
          connection_id: connection.id,
          platform: connection.platform,
          content,
          hashtags,
          status,
          scheduled_for: status === 'scheduled' ? nowIso : undefined,
          retry_count: 0,
        });
        staged++;
      }

      await sr.entities.AgentActivity.create({
        campaign_id: campaign.id,
        campaign_title: campaign.title,
        owner_user_id: campaign.created_by_id,
        category: 'content',
        action: `Autopilot generated a social post and staged it on ${staged} connected platform${staged === 1 ? '' : 's'}.`,
        reason: 'Campaign is opted into autonomous social posting; the weekly cadence guard allowed a new post.',
        expected_impact: 'Steady cross-platform presence that keeps the campaign in front of supporters.',
        result: `Staged ${staged} post${staged === 1 ? '' : 's'} across the connected social destinations.`,
        recommended_next_actions: ['Review the staged post in your campaign distribution panel and edit or approve it.'],
        artifact_type: 'social_post',
        status: 'pending',
      });

      report.campaigns_processed++;
      report.posts_staged += staged;
    }

    return Response.json(report);
  } catch (error) {
    console.error('runSocialAutopilot error:', error.message);
    return Response.json({ error: 'The Social Autopilot hit a problem and could not finish this run.' }, { status: 500 });
  }
}