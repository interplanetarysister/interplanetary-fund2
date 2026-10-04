import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { canAutoPublish, hasFreshProviderVerification, publishThroughConnection } from '../../shared/socialPublish.ts';
import { logAudit } from '../../shared/auditLog.ts';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { assertPlatformAccess } from '../../shared/integrationRegistry.ts';
import { hasImplementedDirectPublishAdapter, hasVerifiedManualShare, resolveCapabilityForPlatform } from '../../shared/providerCapabilities.ts';
import { safeExternalHttpsUrl } from '../../shared/safeExternalUrl.js';

// This endpoint is the authenticated owner's explicit, per-post Publish action.
// Background and agent publishing use their own functions and standing OBO gates;
// a caller-supplied boolean must never decide whether this action is authorized.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;

    const { post_id } = await req.json();
    if (!post_id) return Response.json({ error: 'Missing post_id' }, { status: 400 });

    const post = await base44.entities.DistributedPost.get(post_id).catch(() => null);
    if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });
    const sr = base44.asServiceRole;
    const campaign = post.campaign_id
      ? await sr.entities.Campaign.get(post.campaign_id).catch(() => null)
      : null;
    const connection = await sr.entities.PlatformConnection.get(post.connection_id).catch(() => null);
    if (!campaign || !connection) return Response.json({ error: 'Campaign or connection no longer exists' }, { status: 404 });

    const ownerChainMatches = !!post.created_by_id &&
      !!campaign.created_by_id &&
      !!connection.created_by_id &&
      post.created_by_id === campaign.created_by_id &&
      connection.created_by_id === campaign.created_by_id &&
      (!connection.campaign_id || connection.campaign_id === campaign.id) &&
      user.id === campaign.created_by_id;
    if (!ownerChainMatches) {
      return Response.json({ error: 'Publishing blocked because post, campaign, connection, and caller ownership do not match.' }, { status: 403 });
    }

    if (post.status === 'published') return Response.json({ manual: false, post });

    const capability = await resolveCapabilityForPlatform(sr, connection.platform);
    const manualShareVerified = hasVerifiedManualShare(capability);
    const directPublishVerified = hasImplementedDirectPublishAdapter(capability);
    const profileUrl = safeExternalHttpsUrl(connection.external_url);
    if (!directPublishVerified) {
      const updated = await base44.entities.DistributedPost.update(post_id, { status: 'approved' });
      await logAudit(base44, {
        action: 'post_approved_manual',
        target_type: 'distributed_post',
        target_id: post_id,
        detail: `Direct publish is not IFund-verified for ${connection.platform}`,
        status: 'success',
      });
      return Response.json({
        manual: true,
        verified_manual: manualShareVerified,
        manual_share_method: manualShareVerified ? capability.manual_share_method : '',
        post: updated,
        profile_url: profileUrl,
        reason: manualShareVerified
          ? 'Use the verified manual sharing method for this platform.'
          : 'IFund has not verified publishing for this platform yet.',
      });
    }

    if (!canAutoPublish(connection) || !hasFreshProviderVerification(connection)) {
      const updated = await base44.entities.DistributedPost.update(post_id, { status: 'approved' });
      await logAudit(base44, { action: 'post_approved_manual', target_type: 'distributed_post', target_id: post_id, detail: `Verified direct publishing is not ready for ${connection.platform}`, status: 'failure' });
      return Response.json({ manual: true, verified_manual: manualShareVerified, manual_share_method: manualShareVerified ? capability.manual_share_method : '', post: updated, profile_url: profileUrl, reason: 'The connection needs verification before direct publishing.' });
    }

    const access = await assertPlatformAccess(sr, 'social_publish');
    if (!access.ok) {
      const updated = await base44.entities.DistributedPost.update(post_id, { status: 'approved' });
      await logAudit(base44, { action: 'post_approved_manual', target_type: 'distributed_post', target_id: post_id, detail: `Direct publish blocked: ${access.reason}`, status: 'failure' });
      return Response.json({ manual: true, verified_manual: manualShareVerified, manual_share_method: manualShareVerified ? capability.manual_share_method : '', post: updated, profile_url: profileUrl, reason: access.reason });
    }

    const text = [post.content, ...(post.hashtags || [])].join(' ').trim();
    try {
      const { url } = await publishThroughConnection(connection, text);
      const updated = await base44.entities.DistributedPost.update(post_id, {
        status: 'published',
        published_at: new Date().toISOString(),
        external_post_url: url,
        error: '',
      });
      await sr.entities.PlatformConnection.update(connection.id, {
        status: 'connected',
        verification_status: 'verified',
        last_synced: new Date().toISOString(),
        history: [...(connection.history || []), { at: new Date().toISOString(), event: 'published', detail: `Published post for "${post.campaign_title}"` }].slice(-30),
      });
      await logAudit(base44, { action: 'post_published', target_type: 'distributed_post', target_id: post_id, detail: `Published to ${connection.platform}`, status: 'success' });
      return Response.json({ manual: false, post: updated });
    } catch (pubError) {
      console.error('publishPost publish error:', pubError && pubError.message ? pubError.message : pubError);
      await base44.entities.DistributedPost.update(post_id, { status: 'failed', error: 'Publishing failed.', retry_count: (post.retry_count || 0) + 1 });
      await logAudit(base44, { action: 'post_publish_failed', target_type: 'distributed_post', target_id: post_id, detail: `Publish to ${connection.platform} failed`, status: 'failure' });
      return Response.json({ error: 'Publishing failed. Try again or post manually on the platform.' }, { status: 502 });
    }
  } catch (error) {
    console.error('publishPost error:', error?.message || error);
    return Response.json({ error: 'Unable to publish this post. Please try again.' }, { status: 500 });
  }
}
