import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// External Feed Mirroring worker (invoked by the "External Feed Mirroring"
// workflow, no user context — service-scoped). Pulls the latest posts from the
// connected social platforms (Bluesky and Mastodon public APIs, Discord via the
// authorized shared connector) and mirrors them into the internal Interplanetary
// Social feed as SocialPost records — deduplicated by the external post id.
// Platforms without a readable API (facebook, instagram, tiktok, linkedin) are
// reported as no_read_api and never faked.

const DISCORD_API = 'https://discord.com/api/v10';

function stripHtml(html) {
  return (html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

async function fetchBlueskyPosts(connection) {
  const handle = connection.credentials?.bluesky_handle;
  if (!handle) return { error: 'credentials_required' };
  const res = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(handle)}&limit=20`);
  if (!res.ok) return { error: `bluesky read failed (${res.status})` };
  const data = await res.json();
  const posts = (data.feed || []).map((item) => {
    const post = item.post || {};
    const uri = post.uri || '';
    const rkey = uri.split('/').pop();
    const did = (uri.replace('at://', '').split('/'))[0];
    return {
      external_post_id: uri,
      external_url: did && rkey ? `https://bsky.app/profile/${did}/post/${rkey}` : connection.external_url || '',
      content: (post.record?.text || '').trim(),
    };
  }).filter((p) => p.content);
  return { posts };
}

async function fetchMastodonPosts(connection) {
  const c = connection.credentials || {};
  if (!c.mastodon_instance || !c.mastodon_access_token) return { error: 'credentials_required' };
  const host = c.mastodon_instance.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${c.mastodon_access_token}` };
  const meRes = await fetch(`https://${host}/api/v1/accounts/verify_credentials`, { headers });
  if (!meRes.ok) return { error: `mastodon auth failed (${meRes.status})` };
  const me = await meRes.json();
  const feedRes = await fetch(`https://${host}/api/v1/accounts/${me.id}/statuses?limit=20`, { headers });
  if (!feedRes.ok) return { error: `mastodon read failed (${feedRes.status})` };
  const statuses = await feedRes.json();
  const posts = (statuses || []).map((s) => ({
    external_post_id: `${host}:${s.id}`,
    external_url: s.url || '',
    content: stripHtml(s.content),
  })).filter((p) => p.content);
  return { posts };
}

async function fetchDiscordPosts(base44) {
  let token;
  try {
    const conn = await base44.asServiceRole.connectors.getConnection('discord');
    token = conn.accessToken;
  } catch (e) {
    return { error: 'discord connector not authorized' };
  }
  const headers = { Authorization: `Bearer ${token}`, 'User-Agent': 'InterplanetaryFund/1.0 (feed mirroring)' };
  const guildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, { headers });
  if (!guildsRes.ok) return { error: `discord guilds failed (${guildsRes.status})` };
  const guilds = await guildsRes.json();
  const posts = [];
  for (const guild of (guilds || []).slice(0, 3)) {
    const channelsRes = await fetch(`${DISCORD_API}/guilds/${guild.id}/channels`, { headers });
    if (!channelsRes.ok) continue;
    const channels = await channelsRes.json();
    const textChannels = (channels || []).filter((ch) => ch.type === 0).slice(0, 5);
    for (const channel of textChannels) {
      const msgsRes = await fetch(`${DISCORD_API}/channels/${channel.id}/messages?limit=10`, { headers });
      if (!msgsRes.ok) continue;
      const msgs = await msgsRes.json();
      for (const m of (msgs || [])) {
        const content = (m.content || '').trim();
        if (!content || m.author?.bot) continue;
        posts.push({
          external_post_id: m.id,
          external_url: `https://discord.com/channels/${guild.id}/${channel.id}/${m.id}`,
          content,
          author_name: m.author?.global_name || m.author?.username || '',
        });
      }
    }
  }
  return { posts };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const report = { mirrored: 0, duplicates_skipped: 0, platforms: {} };

    const connections = await sr.entities.PlatformConnection.filter({ kind: 'social', status: 'connected' }, '-updated_date', 200);
    const byPlatform = {};
    for (const c of connections) {
      byPlatform[c.platform] = byPlatform[c.platform] || [];
      byPlatform[c.platform].push(c);
    }

    // Build one plan: platform -> list of { ownerUserId, authorName, posts }
    const plan = [];
    if (byPlatform.bluesky) {
      for (const c of byPlatform.bluesky) {
        const r = await fetchBlueskyPosts(c);
        if (r.error) { plan.push({ platform: 'bluesky', error: r.error }); continue; }
        plan.push({ platform: 'bluesky', ownerUserId: c.created_by_id, authorName: c.display_name || c.credentials?.bluesky_handle || 'Bluesky', posts: r.posts });
      }
    }
    if (byPlatform.mastodon) {
      for (const c of byPlatform.mastodon) {
        const r = await fetchMastodonPosts(c);
        if (r.error) { plan.push({ platform: 'mastodon', error: r.error }); continue; }
        plan.push({ platform: 'mastodon', ownerUserId: c.created_by_id, authorName: c.display_name || 'Mastodon', posts: r.posts });
      }
    }
    if (byPlatform.discord) {
      const r = await fetchDiscordPosts(base44);
      if (r.error) { plan.push({ platform: 'discord', error: r.error }); }
      else {
        for (const c of byPlatform.discord) {
          plan.push({ platform: 'discord', ownerUserId: c.created_by_id, authorName: c.display_name || 'Discord', posts: r.posts });
        }
      }
    }
    for (const platform of ['facebook', 'instagram', 'tiktok', 'linkedin', 'x', 'threads', 'youtube', 'pinterest', 'reddit']) {
      if (byPlatform[platform]) plan.push({ platform, error: 'no_read_api' });
    }

    for (const entry of plan) {
      const stat = report.platforms[entry.platform] || { mirrored: 0, duplicates: 0 };
      if (entry.error) {
        stat.error = entry.error;
        report.platforms[entry.platform] = stat;
        continue;
      }
      // Dedupe against everything already mirrored for this platform.
      const existing = await sr.entities.SocialPost.filter({ source_platform: entry.platform }, '-created_date', 200).catch(() => []);
      const seen = new Set((existing || []).map((p) => p.external_post_id).filter(Boolean));
      for (const post of entry.posts) {
        if (!post.content || seen.has(post.external_post_id)) { stat.duplicates++; continue; }
        await sr.entities.SocialPost.create({
          author_user_id: entry.ownerUserId,
          author_name: post.author_name || entry.authorName,
          content: post.content,
          source_platform: entry.platform,
          external_post_id: post.external_post_id,
          external_url: post.external_url || '',
          agent_managed: true,
          ai_generated: false,
          likes_count: 0,
          reposts_count: 0,
          comments_count: 0,
        });
        stat.mirrored++;
        report.mirrored++;
        seen.add(post.external_post_id);
      }
      report.duplicates_skipped += stat.duplicates;
      report.platforms[entry.platform] = stat;
    }

    return Response.json(report);
  } catch (error) {
    console.error('mirrorExternalPosts error:', error.message);
    return Response.json({ error: 'Feed mirroring hit a problem and could not finish this run.' }, { status: 500 });
  }
}