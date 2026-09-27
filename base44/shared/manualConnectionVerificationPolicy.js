const BLUESKY_SESSION_URL = 'https://bsky.social/xrpc/com.atproto.server.createSession';

function requiredCredential(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

// Only fixed, repository-reviewed provider endpoints may be contacted here.
// Base44 does not expose a proven DNS resolution-and-pinning/private-egress
// control for arbitrary hostnames, so user-supplied Mastodon instances must
// fail closed rather than becoming an SSRF primitive.
export function directVerificationRequest(platform, credentials = {}) {
  if (platform === 'bluesky') {
    if (!requiredCredential(credentials.bluesky_handle)
        || !requiredCredential(credentials.bluesky_app_password)) {
      throw new Error('Connection details are incomplete.');
    }
    return {
      url: BLUESKY_SESSION_URL,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: credentials.bluesky_handle,
          password: credentials.bluesky_app_password,
        }),
        redirect: 'error',
      },
      failureMessage: 'Bluesky could not verify this connection.',
    };
  }

  if (platform === 'mastodon') {
    throw new Error('Direct Mastodon verification is unavailable until private-network egress can be denied safely.');
  }

  throw new Error('This connection cannot be provider-verified by direct credentials.');
}

export const DIRECT_VERIFICATION_ENDPOINTS = Object.freeze({
  bluesky: BLUESKY_SESSION_URL,
});
