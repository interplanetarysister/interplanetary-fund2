import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
const COLLECTION = 'IFundContent';
const SAVE = 'https://www.wixapis.com/wix-data/v2/items/save';
export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const conn = await base44.asServiceRole.connectors.getConnection('wix');
    if (!conn?.accessToken) return Response.json({ error: 'Wix is not connected.' }, { status: 409 });
    const posts = await base44.entities.SocialPost.filter({ author_user_id: user.id });
    const updates = await base44.entities.CampaignUpdate.filter({ created_by_id: user.id });
    const headers = { Authorization: `Bearer ${conn.accessToken}`, 'Content-Type': 'application/json' };
    let synced = 0;
    for (const p of posts) {
      const r = await fetch(SAVE, { method: 'POST', headers, body: JSON.stringify({ dataCollectionId: COLLECTION, dataItem: { id: `post-${p.id}`, data: { sourceType: 'social_post', sourceId: p.id, campaignId: p.campaign_id || '', title: p.campaign_title || '', content: p.content || '', mediaUrl: p.media_url || '', syncedAt: new Date().toISOString() } } }) });
      if (r.ok) synced++;
    }
    for (const u of updates) {
      const r = await fetch(SAVE, { method: 'POST', headers, body: JSON.stringify({ dataCollectionId: COLLECTION, dataItem: { id: `update-${u.id}`, data: { sourceType: 'campaign_update', sourceId: u.id, campaignId: u.campaign_id || '', title: u.title || '', content: u.content || '', mediaUrl: u.media_url || '', syncedAt: new Date().toISOString() } } }) });
      if (r.ok) synced++;
    }
    return Response.json({ ok: true, synced });
  } catch (error) {
    console.error('syncWixContent error:', error?.message || error);
    return Response.json({ error: 'Content could not be synchronized to Wix.' }, { status: 500 });
  }
}