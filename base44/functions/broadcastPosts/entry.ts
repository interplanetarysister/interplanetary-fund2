import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { canAutoPublish, publishThroughConnection, safePublishError } from '../../shared/socialPublish.ts';

// Broadcasts campaign updates to destinations the owner has already authorized
// by linking their account. There is no per-post approval gate.
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
    const now = Date.now();
    const eligible = posts.filter((p) => {
      if (p.status === 'pending_approval' || p.status === 'approved') return true;
      if (p.status === 'scheduled') return p.scheduled_for && new Date(p.scheduled_for).getTime() <= now;
      return false;
    });

    const results = { published: 0, manual: 0, failed: 0, total: eligible.length, posts: [] };

    for (const post of eligible) {
      if (post.created_by_id && post.created_by_id !== user.id && user.role !== 'admin') {
        results.failed++;
        results.posts.push({ id: post.id, status: 'failed', error: 'Post is owned by another user.' });
        continue;
      }

      const connection = await base44.entities.PlatformConnection.get(post.connection_id).catch(() => null);
      if (!connection) {
        const updated = await base44.entities.DistributedPost.update(post.id, {
          status: 'failed', error: 'Connection no longer exists',
        });
        results.failed++;
        results.posts.push(updated);
        continue;
      }
      if (connection.created_by_id !== user.id && user.role !== 'admin') {
        const updated = await base44.entities.DistributedPost.update(post.id, {
          status: 'failed', error: 'Connection is owned by another user.',
        });
        results.failed++;
        results.posts.push(updated);
        continue;
      }
      if (connection.platform !== post.platform) {
        const updated = await base44.entities.DistributedPost.update(post.id, {
          status: 'failed', error: 'Post destination does not match its connection.',
        });
        results.failed++;
        results.posts.push(updated);
        continue;
      }

      const text = [post.content, ...(post.hashtags || [])].join(' ').trim();
      if (!text) {
        const updated = await base44.entities.DistributedPost.update(post.id, {
          status: 'failed', error: 'Post content is empty.',
        });
        results.failed++;
        results.posts.push(updated);
        continue;
      }

      if (!canAutoPublish(connection)) {
        const updated = await base44.entities.DistributedPost.update(post.id, { status: 'approved', error: '' });
        results.manual++;
        results.posts.push(updated);
        continue;
      }

      try {
        const { url } = await publishThroughConnection(connection, text);
        const publishedAt = new Date().toISOString();
        const updated = await base44.entities.DistributedPost.update(post.id, {
          status: 'published',
          published_at: publishedAt,
          external_post_url: url,
          error: '',
        });
        await base44.entities.PlatformConnection.update(connection.id, {
          last_synced: publishedAt,
          history: [...(connection.history || []), {
            at: publishedAt,
            event: 'published',
            detail: `Broadcast post for "${post.campaign_title}"`,
          }].slice(-30),
        });
        results.published++;
        results.posts.push(updated);
      } catch (pubError) {
        console.error('broadcastPosts provider error:', pubError?.message || pubError);
        const safeError = safePublishError();
        const updated = await base44.entities.DistributedPost.update(post.id, {
          status: 'failed',
          error: safeError,
          retry_count: (post.retry_count || 0) + 1,
        });
        results.failed++;
        results.posts.push(updated);
      }
    }

    return Response.json(results);
  } catch (error) {
    console.error('broadcastPosts error:', error?.message || error);
    return Response.json({ error: 'Unable to broadcast campaign updates right now.' }, { status: 500 });
  }
}
