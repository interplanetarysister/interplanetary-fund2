// Shared platform-level linkage knowledge.
// This registry contains no user credentials, OAuth tokens, browser sessions, account IDs,
// campaign IDs, or user consent. It lets later connection attempts reuse a proven route
// while per-user authorization and provider capability verification remain mandatory.

export const TRANSPORT_PRIORITY = [
  'oauth',
  'api',
  'webhook',
  'token',
  'authenticated_browser',
  'public_browser',
  'manual',
];

export const STATIC_CONNECTION_RECIPES = {
  linkedin: { connect: { preferred_transport: 'oauth', connector_type: 'linkedin' } },
  facebook: { connect: { preferred_transport: 'oauth', connector_type: 'facebook_pages' } },
  instagram: { connect: { preferred_transport: 'oauth', connector_type: 'instagram' } },
  discord: { connect: { preferred_transport: 'oauth', connector_type: 'discord' } },
  tiktok: { connect: { preferred_transport: 'oauth', connector_type: 'tiktok' } },
  patreon: { connect: { preferred_transport: 'oauth', connector_type: 'patreon' } },
  kofi: { connect: { preferred_transport: 'webhook', worker_key: 'kofiWebhook' } },
  buymeacoffee: { connect: { preferred_transport: 'token', worker_key: 'buyMeACoffeeApi' } },
  bluesky: { connect: { preferred_transport: 'token', worker_key: 'blueskyDirect' } },
  mastodon: { connect: { preferred_transport: 'token', worker_key: 'mastodonDirect' } },
};

export function staticRecipe(platform, operation = 'connect') {
  return STATIC_CONNECTION_RECIPES[platform]?.[operation] || null;
}

export function orderedTransports(recipe) {
  const preferred = recipe?.preferred_transport;
  const fallbacks = Array.isArray(recipe?.fallback_transports) ? recipe.fallback_transports : [];
  // Never manufacture a fallback order. Only explicitly stored, currently
  // verified methods may be attempted by a caller.
  if (recipe?.status !== 'proven') return [];
  return [...new Set([preferred, ...fallbacks].filter((item) => TRANSPORT_PRIORITY.includes(item)))];
}
