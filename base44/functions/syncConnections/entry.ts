import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { canAutoPublish, publishThroughConnection } from '../../shared/socialPublish.ts';

// Hourly synchronization worker (invoked by the "Connection Sync Engine"
// workflow, no user context — service-scoped like runOutreachAgent):
// 1. Claims due scheduled/retry posts before any irreversible provider call.
// 2. Publishes due posts on auto-capable connections; asks the owner when
//    their permission setting requires it.
// 3. Retries provider failures up to 3 attempts.
// 4. Never automatically republishes a post whose provider outcome is unknown
//    after local persistence fails; stale claims are quarantined for
//    reconciliation instead of risking a duplicate external publication.
// 5. Flags stale connections (>7 days without a sync) for health monitoring.
const MAX_RETRIES = 3;
const STALE_PUBLISH_CLAIM_MS = 15 * 60 * 1000;
const SAFE_PUBLISH_ERROR = 'Publishing failed; the connection can be retried.';
const SAFE_UNKNOWN_OUTCOME = 'Publication outcome could not be confirmed; reconcile before retrying.';
const SAFE_SYNC_ERROR = 'Connection synchronization failed.';

function isStalePublishClaim(post, now) {
  if (post.status !== 'publishing') return false;
  const claimedAt = post.publish_claimed_at ? new Date(post.publish_claimed_at).getTime() : NaN;
  return !Number.isFinite(claimedAt) || now.getTime() - claimedAt >= STALE_PUBLISH_CLAIM_MS;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const now = new Date();
    const report = { published: 0, awaiting_approval: 0, retried: 0, failed: 0, stale_flagged: 0, claims_skipped: 0 };

    // --- Quarantine stale in-flight publication claims ---
    // A stale claim means the worker cannot prove whether the provider call
    // completed before the local write failed. Do not republish automatically.
    const publishing = await sr.entities.DistributedPost.filter({ status: 'publishing' }, '-updated_date', 100);
    for (const post of publishing) {
      if (!isStalePublishClaim(post, now)) continue;
      await sr.entities.DistributedPost.update(post.id, {
        status: 'failed',
        error: SAFE_UNKNOWN_OUTCOME,
        publish_claimed_at: null,
        publish_claim_token: null,
      });
      await sr.entities.Notification.create({
        user_id: post.created_by_id,
        title: 'Post needs publication reconciliation',
        body: `The ${post.platform} publication result could not be confirmed. Reconcile the post before retrying to avoid a duplicate external post.`,
        type: 'system',
        link: `/campaign/${post.campaign_id}`,
      });
      report.stale_flagged++;
    }

    // --- Due scheduled posts + failed retries ---
    const scheduled = await sr.entities.DistributedPost.filter({ status: 'scheduled' }, 'scheduled_for', 100);
    const failed = await sr.entities.DistributedPost.filter({ status: 'failed' }, '-updated_date', 50);
    const queue = [
      ...scheduled.filter((p) => p.scheduled_for && new Date(p.scheduled_for) <= now),
      ...failed.filter((p) => (p.retry_count || 0) < MAX_RETRIES && p.error !== SAFE_UNKNOWN_OUTCOME),
    ];

    for (const post of queue) {
      // Establish the durable per-post claim using the observed status as the
      // compare-and-set condition. Only one concurrent worker can win the
      // transition into publishing for this exact post state.
      const claimToken = `${post.id}:${crypto.randomUUID()}`;
      const claim = await sr.entities.DistributedPost.updateMany(
        { id: post.id, status: post.status },
        {
          $set: {
            status: 'publishing',
            publish_claimed_at: now.toISOString(),
            publish_claim_token: claimToken,
          },
        },
      );

      if (!claim.success || claim.updated !== 1) {
        report.claims_skipped++;
        continue;
      }

      // Re-read after claiming so later updates never rely on a stale queue
      // snapshot for connection, authorization, or retry state.
      const claimedPost = await sr.entities.DistributedPost.get(post.id);
      if (!claimedPost || claimedPost.publish_claim_token !== claimToken) {
        report.claims_skipped++;
        continue;
      }

      const connection = await sr.entities.PlatformConnection.get(claimedPost.connection_id).catch(() => null);
      if (!connection) {
        await sr.entities.DistributedPost.updateMany(
          { id: claimedPost.id, status: 'publishing', publish_claim_token: claimToken },
          {
            $set: {
              status: 'failed',
              error: 'Connection was removed',
              retry_count: MAX_RETRIES,
              publish_claimed_at: null,
              publish_claim_token: null,
            },
          },
        );
        report.failed++;
        continue;
      }

      const text = [claimedPost.content, ...(claimedPost.hashtags || [])].join(' ').trim();
      if (connection.automation_mode === 'auto' && canAutoPublish(connection)) {
        try {
          const { url } = await publishThroughConnection(connection, text);

          // If local persistence loses the claim, leave the post quarantined in
          // publishing state. Automatic retry is deliberately forbidden because
          // the provider may already have accepted the publication.
          const persisted = await sr.entities.DistributedPost.updateMany(
            { id: claimedPost.id, status: 'publishing', publish_claim_token: claimToken },
            {
              $set: {
                status: 'published',
                published_at: now.toISOString(),
                external_post_url: url,
                error: '',
                publish_claimed_at: null,
                publish_claim_token: null,
              },
            },
          );
          if (!persisted.success || persisted.updated !== 1) {
            console.error('syncConnections publish persistence could not be confirmed:', claimedPost.id);
            report.failed++;
            continue;
          }
          report.published++;
        } catch (error) {
          console.error('syncConnections publish error:', error);
          const retries = (claimedPost.retry_count || 0) + 1;
          const nextStatus = retries >= MAX_RETRIES ? 'failed' : 'scheduled';
          const persisted = await sr.entities.DistributedPost.updateMany(
            { id: claimedPost.id, status: 'publishing', publish_claim_token: claimToken },
            {
              $set: {
                status: nextStatus,
                error: SAFE_PUBLISH_ERROR,
                retry_count: retries,
                publish_claimed_at: null,
                publish_claim_token: null,
              },
            },
          );
          if (!persisted.success || persisted.updated !== 1) {
            console.error('syncConnections failure persistence could not be confirmed:', claimedPost.id);
            report.failed++;
            continue;
          }
          if (retries >= MAX_RETRIES) {
            await sr.entities.Notification.create({
              user_id: claimedPost.created_by_id,
              title: 'Post could not be published',
              body: `Publishing to ${claimedPost.platform} failed after ${MAX_RETRIES} attempts.`,
              type: 'system',
              link: `/campaign/${claimedPost.campaign_id}`,
            });
            report.failed++;
          } else report.retried++;
        }
      } else if (claimedPost.status === 'publishing') {
        // Ask/draft mode or no direct API — hand back to the owner instead of auto-posting.
        const persisted = await sr.entities.DistributedPost.updateMany(
          { id: claimedPost.id, status: 'publishing', publish_claim_token: claimToken },
          {
            $set: {
              status: 'pending_approval',
              publish_claimed_at: null,
              publish_claim_token: null,
            },
          },
        );
        if (!persisted.success || persisted.updated !== 1) {
          report.failed++;
          continue;
        }
        await sr.entities.Notification.create({
          user_id: claimedPost.created_by_id,
          title: 'Scheduled post is ready',
          body: `Your ${claimedPost.platform} post for \"${claimedPost.campaign_title}\" is ready — approve it to publish.`,
          type: 'system',
          link: `/campaign/${claimedPost.campaign_id}`,
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
    console.error('syncConnections error:', error);
    return Response.json({ error: SAFE_SYNC_ERROR }, { status: 500 });
  }
}