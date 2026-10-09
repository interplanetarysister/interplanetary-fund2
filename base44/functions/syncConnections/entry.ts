import { isFeatureEnabled } from '../../shared/featureFlagGate.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { canAutoPublish, canPublishViaConnector, hasAiPublishingConsent, publishThroughConnection } from '../../shared/socialPublish.ts';
import { assertExternalAgentAction, assertPlatformAccess } from '../../shared/integrationRegistry.ts';
import { OAUTH_ENV, verifyManualConnection, isLinkBasedPlatform, verifyPublicCampaignConnection } from '../../shared/connectionVerification.ts';
import { resolveCapabilityForPlatform } from '../../shared/providerCapabilities.ts';
import { completeVerifiedManagedWork } from '../../shared/managedQueue.ts';
import { verifiedConnectionCapabilities } from '../../shared/verifiedConnectionCapabilities.ts';
import { hasUnifiedOboConsent } from '../../shared/integrationRegistry.ts';

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
    const report = { published: 0, awaiting_approval: 0, retried: 0, failed: 0, verified: 0, needs_attention: 0, delegations_completed: 0, health_deferred: 0 };
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

    const publishingEnabled = await isFeatureEnabled(base44, 'cross_platform_publishing');
    for (const post of publishingEnabled ? queue : []) {
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
      const capability = await resolveCapabilityForPlatform(sr, connection.platform);
      const directPublishVerified = capability?.direct_publish_verified === true && capability?.test_status === 'passing' && capability?.implementation_status === 'implemented';
      const runtimePublishAvailable = canAutoPublish(connection) || canPublishViaConnector(connection.platform);
      const actionAuthorization = owner && ownerUserId
        ? await assertExternalAgentAction(sr, {
            ownerUser: owner,
            ownerUserId,
            campaign,
            connection,
            capability: 'create_post',
            requireAutomation: true,
          })
        : { ok: false, reason: 'owner unavailable' };
      if (connection.automation_mode === 'auto' && runtimePublishAvailable && directPublishVerified && ownerChainMatches && consentGranted && access.ok && actionAuthorization.ok) {
        try {
          const { url } = await publishThroughConnection(connection, text, sr);
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
          console.error('syncConnections publish failed:', e?.name || 'UnknownError');
          const retries = (post.retry_count || 0) + 1;
          const safePublishError = 'Publishing could not be completed. Review the connection and try again.';
          await sr.entities.DistributedPost.update(post.id, {
            status: retries >= MAX_RETRIES ? 'failed' : post.status === 'failed' ? 'failed' : 'scheduled',
            error: safePublishError,
            retry_count: retries,
          });
          if (retries >= MAX_RETRIES) {
            await sr.entities.Notification.create({
              user_id: post.created_by_id,
              title: 'Post could not be published',
              body: `Publishing to ${post.platform} failed after ${MAX_RETRIES} attempts. Review the connection before retrying.`,
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
          ...(connection.automation_mode === 'auto' && runtimePublishAvailable && directPublishVerified && !ownerChainMatches
            ? { error: 'Automatic publishing blocked: post, campaign, and connection ownership do not match.' }
            : connection.automation_mode === 'auto' && runtimePublishAvailable && directPublishVerified && !consentGranted
              ? { error: 'Automatic publishing blocked: AI OBO authorization is not active.' }
            : connection.automation_mode === 'auto' && runtimePublishAvailable && !directPublishVerified
              ? { error: 'Automatic publishing is not provider-verified for this platform yet.' }
            : connection.automation_mode === 'auto' && !actionAuthorization.ok
              ? { error: `Automatic publishing blocked: ${actionAuthorization.reason}.` }
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
    let probes = 0;
    for (const c of connections) {
      // Per-user OAuth is never tested in a scheduled service context.
      if (OAUTH_ENV[c.platform] || c.platform === 'kofi' ||
          !(c.platform === 'bluesky' || isLinkBasedPlatform(c.platform))) {
        report.health_deferred++;
        continue;
      }
      const lastEvent = (c.history || []).filter((item) =>
        item.event === 'health_check' || item.event === 'health_check_failed').at(-1);
      const lastAttempt = Date.parse(lastEvent?.at || c.last_synced || '');
      if ((Number.isFinite(lastAttempt) && now.getTime() - lastAttempt < 6 * 60 * 60 * 1000) ||
          probes >= 12) {
        report.health_deferred++;
        continue;
      }
      probes++;
      try {
        if (['bluesky'].includes(c.platform)) {
          await verifyManualConnection(c);
        } else if (isLinkBasedPlatform(c.platform)) {
          await verifyPublicCampaignConnection(c);
        } else {
          // Ko-fi is verified by signed provider webhook events; custom/unknown
          // connections remain unverified until a real supported check exists.
          continue;
        }
        const owner = await sr.entities.User.get(c.created_by_id).catch(() => null);
        const version = String(owner?.ai_obo_consent?.permission_version || '');
        const delegated = !!owner && hasUnifiedOboConsent(owner) && !!version &&
          c.obo_consent?.granted === true &&
          c.obo_consent?.opted_out !== true &&
          c.obo_consent?.permission_version === version;
        const verifiedCaps = c.platform === 'bluesky'
          ? verifiedConnectionCapabilities(c)
          : (c.obo_consent?.provider_capabilities || []);
        const checked = await sr.entities.PlatformConnection.update(c.id, {
          status: 'connected', verification_status: 'verified', last_synced: now.toISOString(), last_error: '',
          obo_consent: {
            ...(c.obo_consent || {}),
            provider_capabilities: verifiedCaps,
            granted_capabilities: delegated ? verifiedCaps : [],
          },
          agent_access: {
            ...(c.agent_access || {}),
            shared_with_agents: delegated,
            automation_enabled: delegated && c.automation_mode === 'auto' &&
              verifiedCaps.includes('create_post'),
          },
          history: [...(c.history || []), { at: now.toISOString(), event: 'health_check', detail: 'Scheduled provider verification succeeded' }].slice(-30),
        });
        report.verified++;
        report.delegations_completed += await completeVerifiedManagedWork(sr, checked, now.toISOString()).catch((error) => {
          console.error('Managed work reconciliation could not finish:', error?.name || 'UnknownError');
          return 0;
        });
      } catch (e) {
        console.error('syncConnections provider verification failed:', e?.name || 'UnknownError');
        const reason = String(e?.message || '');
        const reauth = reason === 'Provider authorization needs to be renewed.' || reason === 'Provider sign-in is not configured yet.';
        const message = reauth ? 'Provider authorization needs attention.' : 'Live provider verification could not be completed.';
        await sr.entities.PlatformConnection.update(c.id, {
          status: 'error', verification_status: 'unverified', last_error: message,
          capability_status: c.capability_status || 'unknown',
          agent_access: { ...(c.agent_access || {}), automation_enabled: false },
          history: [...(c.history || []), { at: now.toISOString(), event: 'health_check_failed', detail: message }].slice(-30),
        });
        report.needs_attention++;
      }
    }

    return Response.json(report);
  } catch (error) {
    console.error('syncConnections error:', error?.name || 'UnknownError');
    return Response.json({ error: 'Synchronization encountered a problem and could not finish.' }, { status: 500 });
  }
}