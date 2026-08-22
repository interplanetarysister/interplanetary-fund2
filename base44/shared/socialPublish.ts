// Real posting integrations for platforms whose APIs work with user-supplied
// credentials (no partner approval needed): Bluesky (app password) and
// Mastodon (instance access token). Linking a social account is the user's
// durable authorization for Interplanetary Fund to publish campaign updates.
// No per-post approval is required after the account is linked.

export function canAutoPublish(connection) {
  const c = connection?.credentials || {};
  if (connection?.status && connection.status !== 'connected') return false;
  if (connection?.platform === 'bluesky') return !!(c.bluesky_handle && c.bluesky_app_password);
  if (connection?.platform === 'mastodon') return !!(c.mastodon_instance && c.mastodon_access_token);
  return false;
}

export async function publishToBluesky(handle, appPassword, text) {
  const sessionRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: handle, password: appPassword }),
  });
  if (!sessionRes.ok) throw new Error(`Bluesky login failed (${sessionRes.status}) — check handle and app password.`);
  const session = await sessionRes.json();

  const postRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` },
    body: JSON.stringify({
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record: { $type: 'app.bsky.feed.post', text: text.slice(0, 300), createdAt: new Date().toISOString() },
    }),
  });
  if (!postRes.ok) throw new Error(`Bluesky post failed (${postRes.status}).`);
  const out = await postRes.json();
  const rkey = (out.uri || '').split('/').pop();
  return { url: rkey ? `https://bsky.app/profile/${handle}/post/${rkey}` : `https://bsky.app/profile/${handle}` };
}

export async function publishToMastodon(instance, accessToken, text) {
  const host = instance.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const res = await fetch(`https://${host}/api/v1/statuses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ status: text.slice(0, 500) }),
  });
  if (!res.ok) throw new Error(`Mastodon post failed (${res.status}) — check instance and access token.`);
  const out = await res.json();
  return { url: out.url || `https://${host}` };
}

// Publishes a DistributedPost through its connection. Throws on failure.
export async function publishThroughConnection(connection, text) {
  const c = connection.credentials || {};
  if (connection.platform === 'bluesky') return publishToBluesky(c.bluesky_handle, c.bluesky_app_password, text);
  if (connection.platform === 'mastodon') return publishToMastodon(c.mastodon_instance, c.mastodon_access_token, text);
  throw new Error(`Direct publishing is not available for ${connection.platform} yet.`);
}
