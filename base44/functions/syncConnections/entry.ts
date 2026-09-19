import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { canAutoPublish, publishThroughConnection } from '../../shared/socialPublish.ts';
import { assertOboGrant, assertPlatformAccess } from '../../shared/integrationRegistry.ts';

// Hourly synchronization worker (invoked by the "Connection Sync Engine"
// workflow, no user context — service-scoped like runOutreachAgent):
// 1. Publishes due scheduled posts on auto-capable connections; asks the owner
//    when their permission setting requires it.
// 2. Retries failed publishes (up to 3 attempts) with bounded diagnostics.
// 3. Flags stale connections (>7 days without a sync) for health monitoring.
const MAX_RETRIES = 3;
const SAFE_SYNC_ERROR = 'sync-failed';
const SAFE_PUBLISH_ERROR = 'publish-failed';
const SAFE_CONNECTION_ERROR = 'connection-missing';

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isRecordList = (value) => Array.isArray(value) && value.every(isRecord);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

function classifyThrownValue(value) {
  if (value instanceof Error) return value.name === 'AbortError' ? 'aborted' : 'error';
  if (value === null || value === undefined) return 'nullish';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'object') return 'object';
  return typeof value;
}

function safeDiagnostic(value, fallback) {
  const kind = classifyThrownValue(value);
  return `${fallback}:${kind}`;
}

function isPublishablePost(value) {
  return isRecord(value)
    && isNonEmptyString(value.id)
    && isNonEmptyString(value.connection_id)
    && isNonEmptyString(value.status)
    && (value.retry_count === undefined || Number.isInteger(value.retry_count));
}

function isConnection(value) {
  return isRecord(value) && isNonEmptyString(value.id) && isNonEmptyString(value.status);
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const now = new Date();
    const report = { published: 0, awaiting_approval: 0, retried: 0, failed: 0, stale_flagged: 0 };
    // Centralized access gate: auto-publish only when social publishing is
    // healthy at the registry level. When disabled, due posts fall back to
    // pending_approval (the existing non-auto path) instead of auto-posting.
    const access = await assertPlatformAccess(sr, 'social_publish');

    // --- Due scheduled posts + failed retries ---
    const scheduled = await sr.entities.DistributedPost.filter({ status: 'scheduled' }, 'scheduled_for', 100);
    const failed = await sr.entities.DistributedPost.filter({ status: 'failed' }, '-updated_date', 50);
    const queue = [
      ...(isRecordList(scheduled) ? scheduled.filter((p) => p.scheduled_for && new Date(p.scheduled_for) <= now) : []),
      ...(isRecordList(failed) ? failed.filter((p) => (p.retry_count || 0) < MAX_RETRIES) : []),
    ].filter(isPublishablePost);

    for (const post of queue) {
      const connection = await sr.entities.PlatformConnection.get(post.connection_id).catch(() => null);
      if (!isConnection(connection)) {
        await sr.entities.DistributedPost.update(post.id, { status: 'failed', error: SAFE_CONNECTION_ERROR, retry_count: MAX_RETRIES });
        report.failed++;
        continue;
      }

      const text = [post.content, ...(Array.isArray(post.hashtags) ? post.hashtags : [])]
        .filter((value) => typeof value === 'string')
        .join(' ')
        .trim();
      const campaign = post.campaign_id
        ? await sr.entities.Campaign.get(post.campaign_id).catch(() => null)
        : null;
      const ownerUserId = campaign?.created_by_id || post.created_by_id;
      const obo = ownerUserId
        ? await assertOboGrant(sr, 'platform_outreach_agent', ownerUserId, 'social_publish')
        : { ok: false, reason: 'missing-owner' };
      if (connection.automation_mode === 'auto' && canAutoPublish(connection) && access.ok && obo.ok) {
        try {
          const { url } = await publishThroughConnection(connection, text);
          if (!isNonEmptyString(url)) throw new Error('MALFORMED_PUBLISH_RESPONSE');
          await sr.entities.DistributedPost.update(post.id, {
            status: 'published', published_at: now.toISOString(), external_post_url: url, error: '',
          });
          report.published++;
        } catch (e) {
          const retries = Math.min((Number.isInteger(post.retry_count) ? post.retry_count : 0) + 1, MAX_RETRIES);
          await sr.entities.DistributedPost.update(post.id, {
            status: retries >= MAX_RETRIES ? 'failed' : post.status === 'failed' ? 'failed' : 'scheduled',
            error: safeDiagnostic(e, SAFE_PUBLISH_ERROR),
            retry_count: retries,
          });
          if (retries >= MAX_RETRIES) {
            await sr.entities.Notification.create({
              user_id: post.created_by_id,
              title: 'Post could not be published',
              body: `Your ${post.platform || 'connected'} post could not be published after ${MAX_RETRIES} attempts.`,
              type: 'system',
              link: `/campaign/${post.campaign_id}`,
            });
            report.failed++;
          } else report.retried++;
        }
      } else if (post.status === 'scheduled') {
        // Ask/draft mode, no direct API, disabled registry access, or no OBO grant —
        // hand back to the owner instead of allowing an automated external side effect.
        await sr.entities.DistributedPost.update(post.id, {
          status: 'pending_approval',
          ...(connection.automation_mode === 'auto' && canAutoPublish(connection) && access.ok && !obo.ok
            ? { error: 'automatic-publish-blocked' }
            : {}),
        });
        await sr.entities.Notification.create({
          user_id: post.created_by_id,
          title: 'Scheduled post is ready',
          body: `Your ${post.platform || 'connected'} post is ready — approve it to publish.`,
          type: 'system',
          link: `/campaign/${post.campaign_id}`,
        });
        report.awaiting_approval++;
      }
    }

    // --- Connection health: flag stale connections ---
    const connections = await sr.entities.PlatformConnection.filter({ status: 'connected' }, '-updated_date', 200);
    const staleCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    for (const c of isRecordList(connections) ? connections.filter(isConnection) : []) {
      const stale = !c.last_synced || new Date(c.last_synced) < staleCutoff;
      if (stale && c.last_error !== 'No synchronization in over 7 days') {
        await sr.entities.PlatformConnection.update(c.id, {
          last_error: 'No synchronization in over 7 days',
          history: [...(Array.isArray(c.history) ? c.history : []), { at: now.toISOString(), event: 'health_check', detail: 'Connection is stale — no sync in over 7 days' }].slice(-30),
        });
        report.stale_flagged++;
      }
    }

    return Response.json(report);
  } catch (error) {
    console.error('syncConnections error:', safeDiagnostic(error, SAFE_SYNC_ERROR));
    return Response.json({ error: 'Synchronization encountered a problem and could not finish.' }, { status: 500 });
  }
}