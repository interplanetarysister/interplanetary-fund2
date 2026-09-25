import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { canAutoPublish, hasAiPublishingConsent, publishThroughConnection } from '../../shared/socialPublish.ts';
import { assertPlatformAccess } from '../../shared/integrationRegistry.ts';
import { OAUTH_ENV, verifyManual } from '../verifyPlatformConnection/entry.ts';

// Hourly synchronization worker (invoked by the "Connection Sync Engine"
// workflow, no user context — service-scoped like runOutreachAgent):
// 1. Publishes due scheduled posts on auto-capable connections; asks the owner
//    when their permission setting requires it.
// 2. Retries failed publishes (up to 3 attempts) with error logging.
// 3. Flags stale connections (>7 days without a sync) for health monitoring.
const MAX_RETRIES = 3;

function connectionAutomationAllowed(connection) {
  return connection?.obo_consent?.granted === true &&
    connection?.agent_access?.shared_with_agents === true &&
    connection?.agent_access?.automation_enabled === true;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const now = new Date();
    const report = { published: 0, awaiting_approval: 0, retried: 0, failed: 0, verified: 0, needs_attention: 0 };
    // Centralized access gate: auto-publish only when social publishing is
    // healthy at the registry level. When disabled, due posts fall back to
    // pending_approval (the existing non-auto path) instead of auto-posting.
    const access = await assertPlatformAccess(sr, 'social_publish');

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
      const campaign = post.campaign_id
        ? await sr.entities.Campaign.get(post.campaign_id).catch(() => null)
        : null;
      const ownerUserId = campaign?.created_by_id || post.created_by_id;
      const ownerChainMatches = !!campaign &&
        !!post.created_by_id &&
        !!connection.created_by_id &&
        connection.created_by_id === campaign.created_by_id &&
        post.created_by_id === campaign.created_by_id &&
        (!connection.campaign_id || connection.campaign_id === campaign.id);
      const owner = ownerUserId
        ? await sr.entities.User.get(ownerUserId).catch(() => null)
        : null;
      const consentGranted = hasAiPublishingConsent(owner);
      if (connection.automation_mode === 'auto' && canAutoPublish(connection) && connectionAutomationAllowed(connection) && ownerChainMatches && consentGranted && access.ok) {
        try {
          const { url } = await publishThroughConnection(connection, text);
          await sr.entities.DistributedPost.update(post.id, {
            status: 'published', published_at: now.toISOString(), external_post_url: url, error: '',
          });
          await sr.entities.PlatformConnection.update(connection.id, {
            status: 'connected',
            verification_status: 'verified',
            last_synced: now.toISOString(),
            last_error: '',
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
        // Ask/draft mode, no direct API, disabled registry access, or revoked AI consent —
        // hand back to the owner instead of allowing an automated external side effect.
        await sr.entities.DistributedPost.update(post.id, {
          status: 'pending_approval',
          ...(connection.automation_mode === 'auto' && canAutoPublish(connection) && !connectionAutomationAllowed(connection)
            ? { error: 'Automatic publishing blocked: this connection is not authorized for shared agent automation.' }
            : connection.automation_mode === 'auto' && canAutoPublish(connection) && !ownerChainMatches
            ? { error: 'Automatic publishing blocked: post, campaign, and connection ownership do not match.' }
            : connection.automation_mode === 'auto' && canAutoPublish(connection) && !consentGranted
              ? { error: 'Automatic publishing blocked: AI publishing authorization is not active.' }
            : {}),
        });
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

    // --- Connection health: actively verify every connection we can prove. ---
    // A green dot is refreshed by a provider check, not by the passage of time.
    const connections = await sr.entities.PlatformConnection.filter({}, '-updated_date', 200);
    for (const c of connections) {
      try {
        const envName = OAUTH_ENV[c.platform];
        if (envName) {
          const connectorId = Deno.env.get(envName) || '';
          if (!connectorId) throw new Error('Provider sign-in is not configured yet.');
          const oauth = await sr.connectors.getCurrentAppUserConnection(connectorId);
          if (!oauth?.accessToken) throw new Error('Provider authorization needs to be renewed.');
        } else if (['bluesky', 'mastodon'].includes(c.platform)) {
          await verifyManual(c);
        } else {
          // Ko-fi is verified by its webhook. Link-only platforms remain
          // owner-reported and are not downgraded simply because no read API exists.
          continue;
        }
        await sr.entities.PlatformConnection.update(c.id, {
          status: 'connected', verification_status: 'verified', last_synced: now.toISOString(), last_error: '',
          history: [...(c.history || []), { at: now.toISOString(), event: 'health_check', detail: 'Scheduled provider verification succeeded' }].slice(-30),
        });
        report.verified++;
      } catch (e) {
        const message = String(e?.message || 'Provider authorization needs attention').slice(0, 300);
        await sr.entities.PlatformConnection.update(c.id, {
          status: 'error', verification_status: 'unverified', last_error: message,
          capability_status: OAUTH_ENV[c.platform] ? 'reauthorization_required' : (c.capability_status || 'unknown'),
          history: [...(c.history || []), { at: now.toISOString(), event: 'health_check_failed', detail: message }].slice(-30),
        });
        report.needs_attention++;
      }
    }

    return Response.json(report);
  } catch (error) {
    console.error('syncConnections error:', error.message);
    return Response.json({ error: 'Synchronization encountered a problem and could not finish.' }, { status: 500 });
  }
}