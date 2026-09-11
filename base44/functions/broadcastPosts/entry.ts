import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { canAutoPublish, publishThroughConnection } from '../../shared/socialPublish.ts';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { assertPlatformAccess } from '../../shared/integrationRegistry.ts';

const MAX_ID_LENGTH = 128;
const MAX_RESULTS = 100;
const CONTROL = /[\u0000-\u001F\u007F]/;
const classify = (e) => e instanceof Error ? 'error' : e === null ? 'null' : Array.isArray(e) ? 'array' : typeof e;
const safeId = (v) => typeof v === 'string' && (v = v.trim()) && v.length <= MAX_ID_LENGTH && !CONTROL.test(v) ? v : null;
const project = (p) => p && typeof p === 'object' && typeof p.id === 'string' && typeof p.status === 'string' ? {
  id: p.id.slice(0, MAX_ID_LENGTH), status: p.status.slice(0, 32),
  published_at: typeof p.published_at === 'string' ? p.published_at.slice(0, 64) : null,
  external_post_url: typeof p.external_post_url === 'string' ? p.external_post_url.slice(0, 512) : null,
  error: typeof p.error === 'string' ? p.error.slice(0, 160) : null,
  retry_count: Number.isInteger(p.retry_count) && p.retry_count >= 0 && p.retry_count <= 100 ? p.retry_count : 0,
} : null;

export default async function(req) {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: { Allow: 'POST' } });
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;
    let body;
    try { body = await req.json(); } catch { return Response.json({ error: 'Invalid JSON body.' }, { status: 400 }); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((k) => k !== 'campaign_id')) return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    const campaignId = safeId(body.campaign_id);
    if (!campaignId) return Response.json({ error: 'Invalid campaign_id.' }, { status: 400 });

    let campaign;
    try { campaign = await base44.entities.Campaign.get(campaignId); }
    catch (e) { console.error('broadcastPosts campaign lookup failed:', classify(e)); return Response.json({ error: 'Unable to load this campaign.' }, { status: 502 }); }
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.created_by_id !== user.id && user.role !== 'admin') return Response.json({ error: 'Only the campaign owner can broadcast.' }, { status: 403 });

    const access = await assertPlatformAccess(base44.asServiceRole, 'social_publish');
    if (!access.ok) return Response.json({ error: 'Social publishing is currently disabled.' }, { status: 403 });
    let posts;
    try { posts = await base44.entities.DistributedPost.filter({ campaign_id: campaignId }, '-created_date', MAX_RESULTS); }
    catch (e) { console.error('broadcastPosts post lookup failed:', classify(e)); return Response.json({ error: 'Unable to load posts for this campaign.' }, { status: 502 }); }
    if (!Array.isArray(posts) || posts.length > MAX_RESULTS) return Response.json({ error: 'Unable to load posts for this campaign.' }, { status: 502 });

    const pending = posts.filter((p) => p && typeof p === 'object' && ['pending_approval', 'draft', 'approved', 'failed'].includes(p.status));
    const results = { published: 0, manual: 0, failed: 0, total: pending.length, posts: [] };
    for (const post of pending) {
      const connection = await base44.entities.PlatformConnection.get(post.connection_id).catch(() => null);
      if (!connection) {
        const updated = await base44.entities.DistributedPost.update(post.id, { status: 'failed', error: 'Connection no longer exists' });
        const safe = project(updated); if (!safe) return Response.json({ error: 'Unable to finalize broadcast results.' }, { status: 502 });
        results.failed++; results.posts.push(safe); continue;
      }
      const text = [typeof post.content === 'string' ? post.content.slice(0, 4000) : '', ...(Array.isArray(post.hashtags) ? post.hashtags.filter((h) => typeof h === 'string').map((h) => h.slice(0, 100)) : [])].join(' ').trim();
      if (!canAutoPublish(connection)) {
        const updated = await base44.entities.DistributedPost.update(post.id, { status: 'approved' });
        const safe = project(updated); if (!safe) return Response.json({ error: 'Unable to finalize broadcast results.' }, { status: 502 });
        results.manual++; results.posts.push(safe); continue;
      }
      try {
        const { url } = await publishThroughConnection(connection, text);
        const updated = await base44.entities.DistributedPost.update(post.id, { status: 'published', published_at: new Date().toISOString(), external_post_url: typeof url === 'string' ? url.slice(0, 512) : '', error: '' });
        await base44.entities.PlatformConnection.update(connection.id, { last_synced: new Date().toISOString(), history: [...(Array.isArray(connection.history) ? connection.history : []), { at: new Date().toISOString(), event: 'published', detail: 'Broadcast post' }].slice(-30) });
        const safe = project(updated); if (!safe) return Response.json({ error: 'Unable to finalize broadcast results.' }, { status: 502 });
        results.published++; results.posts.push(safe);
      } catch (e) {
        console.error('broadcastPosts publish failed:', classify(e));
        const updated = await base44.entities.DistributedPost.update(post.id, { status: 'failed', error: 'Publishing failed.', retry_count: (Number.isInteger(post.retry_count) && post.retry_count >= 0 ? post.retry_count : 0) + 1 });
        const safe = project(updated); if (!safe) return Response.json({ error: 'Unable to finalize broadcast results.' }, { status: 502 });
        results.failed++; results.posts.push(safe);
      }
    }
    return Response.json(results);
  } catch (e) {
    console.error('broadcastPosts error:', classify(e));
    return Response.json({ error: 'Unable to broadcast your posts. Please try again.' }, { status: 500 });
  }
}