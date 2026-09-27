export const MASTODON_NETWORK_BLOCK_REASON =
  'Mastodon network access is unavailable until DNS pinning and private-egress controls are enforced.';

export function denyMastodonNetworkAccess() {
  throw new Error(MASTODON_NETWORK_BLOCK_REASON);
}
