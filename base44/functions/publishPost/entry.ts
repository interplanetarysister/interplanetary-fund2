import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { canAutoPublish, publishThroughConnection } from '../../shared/socialPublish.ts';

// Publishes only owner-approved posts through an explicitly auto-authorized connection.
// Unsupported/manual destinations return manual=true so the UI can hand the owner
// finished content without pretending an API exists.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { post_id } = await req.json();
    if (!post_id) return Response.json({ error: 'Missing post_id' }, { status: 400 });

    const post = await base44.entities.DistributedPost.get(post_id).catch(() => null);
    if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });

    // Publishing is a consequential external action. Never allow draft, pending,
    // failed, or otherwise unapproved posts to reach a destination.
    if (post.status !== 'approved' && post.status !== 'scheduled') {
      return Response.json({ error: 'Post must be approved before publishing.' }, { status: 409 });
    }

    const connection = await base44.entities.PlatformConnection.get(post.connection_id).catch(() => null);
    if (!connection) return Response.json({ error: 'Connection no longer exists' }, { status: 404 });

    const text = [post.content, ...(post.hashtags || [])].join(' ').trim();

    if (!canAutoPublish(connection, user)) {
      const updated = await base44.entities.DistributedPost.update(post_id, { status: 'approved' });
      return Response.json({ manual: true, post: updated, profile_url: connection.external_url || '' });
    }

    try {
      const { url } = await publishThroughConnection(connection, text);
      const updated = await base44.entities.DistributedPost.update(post_id, {
        status: 'published',
        published_at: new Date().toISOString(),
        external_post_url: url,
        error: '',
      });
      await base44.entities.PlatformConnection.update(connection.id, {
        last_synced: new Date().toISOString(),
        history: [...(connection.history || []), { at: new Date().toISOString(), event: 'published', detail: `Published post for "${post.campaign_title}"` }].slice(-30),
      });
      return Response.json({ manual: false, post: updated });
    } catch (pubError) {
      await base44.entities.DistributedPost.update(post_id, {
        status: 'failed',
        error: pubError.message,
        retry_count: (post.retry_count || 0) + 1,
      });
      return Response.json({ error: pubError.message }, { status: 502 });
    }
  } catch (error) {
    console.error('publishPost error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
