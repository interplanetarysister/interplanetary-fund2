import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { canAutoPublish, publishThroughConnection } from '../../shared/socialPublish.ts';
import { logAudit } from '../../shared/auditLog.ts';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { assertPlatformAccess } from '../../shared/integrationRegistry.ts';

// Publishes an approved DistributedPost. Where the platform supports direct
// posting with the owner's credentials (Bluesky, Mastodon), it publishes for
// real; otherwise it returns manual=true so the UI hands the owner the
// finished content to post themselves — never pretending an API exists.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;

    const { post_id } = await req.json();
    if (!post_id) return Response.json({ error: 'Missing post_id' }, { status: 400 });

    // User-scoped read — RLS guarantees the post belongs to the caller.
    const post = await base44.entities.DistributedPost.get(post_id).catch(() => null);
    if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });
    // Idempotency: never re-publish a post that already went live.
    if (post.status === 'published') {
      return Response.json({ manual: false, post });
    }
    const connection = await base44.entities.PlatformConnection.get(post.connection_id).catch(() => null);
    if (!connection) return Response.json({ error: 'Connection no longer exists' }, { status: 404 });

    const text = [post.content, ...(post.hashtags || [])].join(' ').trim();

    if (!canAutoPublish(connection)) {
      const updated = await base44.entities.DistributedPost.update(post_id, { status: 'approved' });
      await logAudit(base44, { action: 'post_approved_manual', target_type: 'distributed_post', target_id: post_id, detail: `Manual post for ${connection.platform}`, status: 'success' });
      return Response.json({ manual: true, post: updated, profile_url: connection.external_url || '' });
    }

    try {
      // Centralized access gate: if social publishing is revoked/disabled at the
      // registry level, fall back to a manual handoff instead of auto-posting.
      const access = await assertPlatformAccess(base44.asServiceRole, 'social_publish');
      if (!access.ok) {
        const updated = await base44.entities.DistributedPost.update(post_id, { status: 'approved' });
        await logAudit(base44, { action: 'post_approved_manual', target_type: 'distributed_post', target_id: post_id, detail: `Auto-publish blocked by registry: ${access.reason}`, status: 'failure' });
        return Response.json({ manual: true, post: updated, profile_url: connection.external_url || '', reason: access.reason });
      }
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
      await logAudit(base44, { action: 'post_published', target_type: 'distributed_post', target_id: post_id, detail: `Published to ${connection.platform}`, status: 'success' });
      return Response.json({ manual: false, post: updated });
    } catch (pubError) {
      console.error('publishPost publish error:', pubError && pubError.message ? pubError.message : pubError);
      await base44.entities.DistributedPost.update(post_id, {
        status: 'failed',
        error: 'Publishing failed.',
        retry_count: (post.retry_count || 0) + 1,
      });
      await logAudit(base44, { action: 'post_publish_failed', target_type: 'distributed_post', target_id: post_id, detail: `Publish to ${connection.platform} failed`, status: 'failure' });
      return Response.json({ error: 'Publishing failed. Try again or post manually on the platform.' }, { status: 502 });
    }
  } catch (error) {
    console.error('publishPost error:', error.message);
    return Response.json({ error: 'Unable to publish this post. Please try again.' }, { status: 500 });
  }
}