import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { canAutoPublish, publishThroughConnection } from '../../shared/socialPublish.ts';

// Broadcasts approved DistributedPost records for a campaign in one call —
// the owner's "publish everything I approved" action. Direct-publishes where
// the platform supports it (Bluesky, Mastodon); marks the rest "approved"
// with manual=true so the owner can copy-post to destinations without a
// publishing API. Never auto-posts without explicit post approval.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { campaign_id } = await req.json();
    if (!campaign_id) return Response.json({ error: 'Missing campaign_id' }, { status: 400 });

    const campaign = await base44.entities.Campaign.get(campaign_id).catch(() => null);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.created_by_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the campaign owner can broadcast.' }, { status: 403 });
    }

    const posts = await base44.entities.DistributedPost.filter({ campaign_id }, '-created_date', 100);
    // Approval is a hard authorization boundary. Draft, pending, and failed
    // posts must be explicitly approved before this endpoint can publish them.
    const approved = posts.filter((p) => p.status === 'approved');

    const results = { published: 0, manual: 0, failed: 0, total: approved.length, posts: [] };

    for (const post of approved) {
      const connection = await base44.entities.PlatformConnection.get(post.connection_id).catch(() => null);
      if (!connection) {
        const updated = await base44.entities.DistributedPost.update(post.id, {
          status: 'failed', error: 'Connection no longer exists',
        });
        results.failed++;
        results.posts.push(updated);
        continue;
      }

      const text = [post.content, ...(post.hashtags || [])].join(' ').trim();

      if (!canAutoPublish(connection)) {
        // Keep the approved state intact. The caller is still authorized to
        // copy-post the content manually; this endpoint must not manufacture
        // approval for an unapproved record.
        results.manual++;
        results.posts.push(post);
        continue;
      }

      try {
        const { url } = await publishThroughConnection(connection, text);
        const updated = await base44.entities.DistributedPost.update(post.id, {
          status: 'published',
          published_at: new Date().toISOString(),
          external_post_url: url,
          error: '',
        });
        await base44.entities.PlatformConnection.update(connection.id, {
          last_synced: new Date().toISOString(),
          history: [...(connection.history || []), {
            at: new Date().toISOString(),
            event: 'published',
            detail: `Broadcast post for "${post.campaign_title}"`,
          }].slice(-30),
        });
        results.published++;
        results.posts.push(updated);
      } catch (pubError) {
        const updated = await base44.entities.DistributedPost.update(post.id, {
          status: 'failed',
          error: pubError.message,
          retry_count: (post.retry_count || 0) + 1,
        });
        results.failed++;
        results.posts.push(updated);
      }
    }

    return Response.json(results);
  } catch (error) {
    console.error('broadcastPosts error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}