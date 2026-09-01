import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

// AI Campaign Distribution Engine — generates platform-tailored post content
// for each connected social AND crowdfunding destination (never identical
// copies), saved as DistributedPost drafts the owner can approve before
// broadcasting — direct-publish where an API exists, copy-to-post otherwise.

const PLATFORM_RULES = {
  facebook: 'Facebook: warm, story-driven, 2-4 short paragraphs, up to 400 words, 2-3 hashtags at the end.',
  instagram: 'Instagram: emotive caption, short punchy lines, emoji-friendly, under 2200 chars, 8-12 hashtags.',
  threads: 'Threads: conversational, under 500 chars, 1-3 hashtags.',
  x: 'X: punchy, under 260 chars including link placeholder, 1-2 hashtags.',
  linkedin: 'LinkedIn: professional, impact-focused, 2-3 paragraphs, 3-5 hashtags.',
  tiktok: 'TikTok: video caption idea + hook line, casual, under 150 chars, 3-5 hashtags.',
  pinterest: 'Pinterest: descriptive pin title + description, aspirational, 2-4 hashtags.',
  reddit: 'Reddit: honest, no marketing tone, no hashtags, transparent ask with context.',
  youtube: 'YouTube Community: friendly update style, 1-2 paragraphs, no hashtags.',
  discord: 'Discord: community announcement tone, short, emoji ok, no hashtags.',
  bluesky: 'Bluesky: under 280 chars, authentic, 1-2 hashtags.',
  mastodon: 'Mastodon: under 480 chars, genuine and community-minded, 2-3 hashtags.',
  // Crowdfunding destinations — update-style posts the owner copies into the
  // external campaign page (no posting API available).
  gofundme: 'GoFundMe update: heartfelt progress update, 1-3 paragraphs, thank supporters and share progress toward goal, no hashtags.',
  kickstarter: 'Kickstarter update: backer update tone, milestone-focused, 2-3 paragraphs, no hashtags.',
  indiegogo: 'Indiegogo update: backer/perk update, progress and gratitude, 2-3 paragraphs.',
  fundrazr: 'FundRazr update: community update, concise, gratitude and progress, 1-2 paragraphs.',
  givesendgo: 'GiveSendGo update: faith-friendly community update, gratitude and progress, 1-2 paragraphs.',
  spotfund: 'Spotfund update: brief community update, thank supporters, progress toward goal.',
  kofi: 'Ko-fi post: casual community update, thank supporters, share progress, 1-2 short paragraphs.',
  buymeacoffee: 'Buy Me a Coffee post: casual update to supporters, gratitude and progress, 1-2 paragraphs.',
  patreon: 'Patreon post: patron update, behind-the-scenes tone, gratitude, 2-3 paragraphs.',
  custom: 'Custom site update: general campaign update, gratitude and progress, 2-3 paragraphs.',
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;

    const { campaign_id, connection_ids } = await req.json();
    if (!campaign_id || !Array.isArray(connection_ids) || !connection_ids.length) {
      return Response.json({ error: 'Pick at least one connected platform.' }, { status: 400 });
    }

    const campaign = await base44.entities.Campaign.get(campaign_id).catch(() => null);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.created_by_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the campaign owner can distribute it.' }, { status: 403 });
    }

    // Connections are read user-scoped — RLS guarantees they belong to the caller.
    // Both social and crowdfunding destinations are eligible for distribution.
    const all = await base44.entities.PlatformConnection.filter({});
    const targets = all.filter((c) => connection_ids.includes(c.id) && c.automation_mode !== 'manual');
    if (!targets.length) {
      return Response.json({ error: 'No selected platforms allow AI content. Check each connection\'s automation setting.' }, { status: 400 });
    }

    const p = campaign.ai_profile || {};
    const url = `${new URL(req.url).origin}/campaign/${campaign_id}`;
    const prompt = `You are the AI Campaign Distribution Engine for Interplanetary Fund.
Compliance (non-negotiable): never fabricate facts, amounts, names, or urgency; use only the campaign context; no spam; no false promises.

Write one tailored post per platform below. Do NOT reuse the same text — adapt tone, length, and format per platform rules. Every post must include the campaign link ${url}.

Platform rules:
${targets.map((c) => `- ${c.platform}: ${PLATFORM_RULES[c.platform] || 'General social post, under 400 chars.'}`).join('\n')}

Campaign context:
Title: ${campaign.title}
Summary: ${campaign.summary || ''}
Goal: $${campaign.goal_amount} | Raised: $${campaign.raised_amount || 0} from ${campaign.donor_count || 0} donors
Story (excerpt): ${(campaign.story || '').slice(0, 1200)}
${p.tone ? `Tone: ${p.tone}` : ''} ${p.always_emphasize ? `Always emphasize: ${p.always_emphasize}` : ''} ${p.avoid_words ? `Avoid: ${p.avoid_words}` : ''} ${p.never_change ? `Never change: ${p.never_change}` : ''}

Return JSON only.`;

    const res = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          posts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                platform: { type: 'string' },
                content: { type: 'string' },
                hashtags: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
    });

    const created = [];
    for (const post of (res.posts || [])) {
      const conn = targets.find((c) => c.platform === post.platform);
      if (!conn || !post.content) continue;
      const record = await base44.entities.DistributedPost.create({
        campaign_id,
        campaign_title: campaign.title,
        connection_id: conn.id,
        platform: conn.platform,
        content: post.content,
        hashtags: post.hashtags || [],
        status: conn.automation_mode === 'draft' ? 'draft' : 'pending_approval',
      });
      created.push(record);
    }
    return Response.json({ posts: created });
  } catch (error) {
    console.error('generateDistributionContent error:', error.message);
    return Response.json({ error: 'Unable to generate distribution content. Please try again.' }, { status: 500 });
  }
}