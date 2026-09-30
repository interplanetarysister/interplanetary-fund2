import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { canAutoPublish, publishThroughConnection, safePublishError } from '../../shared/socialPublish.ts';

// Campaign update cross-posting + follower notifications.
// Auto-publishing is limited to the campaign owner's explicitly authorized
// connections; all other destinations become reviewable DistributedPosts.

const PLATFORM_RULES = {
  facebook: 'Facebook: warm update, 2-3 short paragraphs, up to 400 words, 2-3 hashtags.',
  instagram: 'Instagram: emotive update caption, emoji-friendly, under 2200 chars, 8-12 hashtags.',
  threads: 'Threads: conversational update, under 500 chars, 1-3 hashtags.',
  x: 'X: punchy update, under 260 chars including link, 1-2 hashtags.',
  linkedin: 'LinkedIn: professional impact update, 2-3 paragraphs, 3-5 hashtags.',
  tiktok: 'TikTok: update caption + hook, casual, under 150 chars, 3-5 hashtags.',
  pinterest: 'Pinterest: descriptive pin + update, aspirational, 2-4 hashtags.',
  reddit: 'Reddit: honest update, no marketing tone, no hashtags.',
  youtube: 'YouTube Community: friendly update, 1-2 paragraphs, no hashtags.',
  discord: 'Discord: community announcement, short, emoji ok, no hashtags.',
  bluesky: 'Bluesky: under 280 chars, authentic update, 1-2 hashtags.',
  mastodon: 'Mastodon: under 480 chars, genuine update, 2-3 hashtags.',
  gofundme: 'GoFundMe update: heartfelt progress update, 1-3 paragraphs, thank supporters, no hashtags.',
  kickstarter: 'Kickstarter update: backer update, milestone-focused, 2-3 paragraphs, no hashtags.',
  indiegogo: 'Indiegogo update: backer/perk update, progress and gratitude, 2-3 paragraphs.',
  fundrazr: 'FundRazr update: community update, concise, gratitude and progress.',
  givesendgo: 'GiveSendGo update: faith-friendly community update, gratitude and progress.',
  spotfund: 'Spotfund update: brief community update, thank supporters, progress.',
  kofi: 'Ko-fi post: casual community update, thank supporters, share progress.',
  buymeacoffee: 'Buy Me a Coffee post: casual update, gratitude and progress.',
  patreon: 'Patreon post: patron update, behind-the-scenes, gratitude, 2-3 paragraphs.',
  custom: 'Custom site update: general campaign update, gratitude and progress.',
};

const COMPLIANCE = `Compliance (non-negotiable): never fabricate facts, amounts, names, or urgency; use only the update and campaign context; no spam; no false promises.`;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { campaign_id, title, content, media_url, media_type, cross_post } = await req.json();
    if (!content || !content.trim()) return Response.json({ error: 'Update content is required.' }, { status: 400 });

    const campaign = await base44.entities.Campaign.get(campaign_id).catch(() => null);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.created_by_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the campaign owner can post updates.' }, { status: 403 });
    }

    const update = await base44.entities.CampaignUpdate.create({
      campaign_id,
      title: title || undefined,
      content,
      media_url: media_url || undefined,
      media_type: media_type || (media_url ? 'image' : 'none'),
    });

    const crosspost = { generated: 0, published: 0, pending: 0, drafts: 0, failed: 0, skipped: 0 };
    if (cross_post !== false) {
      const connections = await base44.entities.PlatformConnection.filter({});
      const targets = connections.filter((c) => c.automation_mode !== 'manual');
      crosspost.skipped = connections.length - targets.length;

      if (targets.length) {
        const url = `${new URL(req.url).origin}/campaign/${campaign_id}`;
        const prompt = `You are the AI Campaign Distribution Engine for Interplanetary Fund.
${COMPLIANCE}
A campaign owner just published an update. Write one platform-tailored post per platform announcing this update. Do NOT reuse identical text — adapt tone, length, and format per platform rules. Every post must include the campaign link ${url}.

Platform rules:
${targets.map((c) => `- ${c.platform}: ${PLATFORM_RULES[c.platform] || 'General social post, under 400 chars.'}`).join('\n')}

Campaign: ${campaign.title}
${campaign.summary ? `Summary: ${campaign.summary}` : ''}
Update title: ${title || '(none)'}
Update content: ${content}

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

        for (const post of (res.posts || [])) {
          const conn = targets.find((c) => c.platform === post.platform);
          if (!conn || !post.content) continue;
          const text = [post.content, ...(post.hashtags || [])].join(' ').trim();
          crosspost.generated++;

          if (conn.automation_mode === 'auto' && canAutoPublish(conn, user)) {
            try {
              const { url: postUrl } = await publishThroughConnection(conn, text);
              await base44.entities.DistributedPost.create({
                campaign_id, campaign_title: campaign.title, connection_id: conn.id, platform: conn.platform,
                source_update_id: update.id, content: post.content, hashtags: post.hashtags || [],
                status: 'published', published_at: new Date().toISOString(), external_post_url: postUrl,
              });
              crosspost.published++;
            } catch (e) {
              console.error('postCampaignUpdate provider error:', e?.message || e);
              await base44.entities.DistributedPost.create({
                campaign_id, campaign_title: campaign.title, connection_id: conn.id, platform: conn.platform,
                source_update_id: update.id, content: post.content, hashtags: post.hashtags || [],
                status: 'failed', error: safePublishError(), retry_count: 1,
              });
              crosspost.failed++;
            }
          } else {
            await base44.entities.DistributedPost.create({
              campaign_id, campaign_title: campaign.title, connection_id: conn.id, platform: conn.platform,
              source_update_id: update.id, content: post.content, hashtags: post.hashtags || [],
              status: conn.automation_mode === 'draft' ? 'draft' : 'pending_approval',
            });
            if (conn.automation_mode === 'draft') crosspost.drafts++;
            else crosspost.pending++;
          }
        }
      }
    }

    const sr = base44.asServiceRole;
    const followers = await sr.entities.FollowedCampaign.filter({ campaign_id, archived: false });
    let notified = 0;
    const body = title || content.slice(0, 120);
    for (const f of followers) {
      if (f.notification_prefs && f.notification_prefs.updates === false) continue;
      await sr.entities.Notification.create({
        user_id: f.user_id,
        title: `New update from ${campaign.title}`,
        body,
        type: 'update',
        link: `/campaign/${campaign_id}`,
      });
      notified++;
    }

    return Response.json({ update, crosspost, followers_notified: notified });
  } catch (error) {
    console.error('postCampaignUpdate error:', error?.message || error);
    return Response.json({ error: 'Unable to publish the campaign update right now.' }, { status: 500 });
  }
}
