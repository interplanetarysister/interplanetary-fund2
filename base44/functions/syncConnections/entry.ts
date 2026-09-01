import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { canAutoPublish, publishThroughConnection } from '../../shared/socialPublish.ts';

// Hourly synchronization worker (invoked by the "Connection Sync Engine"
// workflow, no user context — service-scoped like runOutreachAgent):
// 1. Publishes due scheduled posts on auto-capable connections; asks the owner
//    when their permission setting requires it.
// 2. Retries failed publishes (up to 3 attempts) with error logging.
// 3. Flags stale connections (>7 days without a sync) for health monitoring.
const MAX_RETRIES = 3;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const now = new Date();
    const report = { published: 0, awaiting_approval: 0, retried: 0, failed: 0, stale_flagged: 0 };

    // --- Due scheduled posts + failed retries ---
    const scheduled = await sr.entities.DistributedPost.filter({ status: 'scheduled' }, 'scheduled_for', 100);
    const failed = await sr.entities.DistributedPost.filter({ status: 'failed' }, '-updated_date', 50);
    const queue = [
      ...scheduled.filter((p) => p.scheduled_for && new Date(p.scheduled_for) <= now),
      ...failed.filter((p) => (p.retry_count || 0) < MAX_RETRIES),
    ];

    for (const post of queue) {
      const connection = await sr.entities.PlatformConnection.get(post.connection_id).catch(() => null);
      if (!connection) {
        await sr.entities.DistributedPost.update(post.id, { status: 'failed', error: 'Connection was removed', retry_count: MAX_RETRIES });
        report.failed++;
        continue;
      }

      const text = [post.content, ...(post.hashtags || [])].join(' ').trim();
      if (connection.automation_mode === 'auto' && canAutoPublish(connection)) {
        try {
          const { url } = await publishThroughConnection(connection, text);
          await sr.entities.DistributedPost.update(post.id, {
            status: 'published', published_at: now.toISOString(), external_post_url: url, error: '',
          });
          report.published++;
        } catch (e) {
          const retries = (post.retry_count || 0) + 1;
          await sr.entities.DistributedPost.update(post.id, {
            status: retries >= MAX_RETRIES ? 'failed' : post.status === 'failed' ? 'failed' : 'scheduled',
            error: e.message,
            retry_count: retries,
          });
          if (retries >= MAX_RETRIES) {
            await sr.entities.Notification.create({
              user_id: post.created_by_id,
              title: 'Post could not be published',
              body: `Publishing to ${post.platform} failed after ${MAX_RETRIES} attempts: ${e.message}`,
              type: 'system',
              link: `/campaign/${post.campaign_id}`,
            });
            report.failed++;
          } else report.retried++;
        }
      } else if (post.status === 'scheduled') {
        // Ask/draft mode or no direct API — hand back to the owner instead of auto-posting.
        await sr.entities.DistributedPost.update(post.id, { status: 'pending_approval' });
        await sr.entities.Notification.create({
          user_id: post.created_by_id,
          title: 'Scheduled post is ready',
          body: `Your ${post.platform} post for "${post.campaign_title}" is ready — approve it to publish.`,
          type: 'system',
          link: `/campaign/${post.campaign_id}`,
        });
        report.awaiting_approval++;
      }
    }

    // --- Connection health: flag stale connections ---
    const connections = await sr.entities.PlatformConnection.filter({ status: 'connected' }, '-updated_date', 200);
    const staleCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    for (const c of connections) {
      const stale = !c.last_synced || new Date(c.last_synced) < staleCutoff;
      if (stale && c.last_error !== 'No synchronization in over 7 days') {
        await sr.entities.PlatformConnection.update(c.id, {
          last_error: 'No synchronization in over 7 days',
          history: [...(c.history || []), { at: now.toISOString(), event: 'health_check', detail: 'Connection is stale — no sync in over 7 days' }].slice(-30),
        });
        report.stale_flagged++;
      }
    }

    return Response.json(report);
  } catch (error) {
    console.error('syncConnections error:', error.message);
    return Response.json({ error: 'Synchronization encountered a problem and could not finish.' }, { status: 500 });
  }
}