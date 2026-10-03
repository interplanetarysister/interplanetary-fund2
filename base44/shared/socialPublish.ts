// Direct publishing for fixed-endpoint providers whose APIs work with
// user-supplied credentials. Mastodon remains fail-closed because its instance
// hostname is user-controlled and this runtime lacks proven private-egress
// controls.
import { denyMastodonNetworkAccess } from './mastodonNetworkPolicy.js';
export { hasFreshProviderVerification } from './providerVerificationPolicy.js';

export function hasAiPublishingConsent(user) {
  // Canonical IFund-wide OBO is the sole authorization decision for automated
  // publishing. Legacy ai_publishing_consent / ai_connection_consent are
  // mirrored on write only (see setUnifiedOboConsent) and are no longer
  // consulted here.
  return user?.ai_obo_consent?.granted === true;
}

export function canAutoPublish(connection) {
  const c = connection?.credentials || {};
  if (connection?.platform === 'bluesky') return !!(c.bluesky_handle && c.bluesky_app_password);
  if (connection?.platform === 'mastodon') return false;
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
  void instance;
  void accessToken;
  void text;
  denyMastodonNetworkAccess();
}

// Publishes a DistributedPost through its connection. Throws on failure.
export async function publishThroughConnection(connection, text) {
  const c = connection.credentials || {};
  if (connection.platform === 'bluesky') return publishToBluesky(c.bluesky_handle, c.bluesky_app_password, text);
  if (connection.platform === 'mastodon') return publishToMastodon(c.mastodon_instance, c.mastodon_access_token, text);
  throw new Error(`Direct publishing is not available for ${connection.platform} yet.`);
}
