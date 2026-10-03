import { recipeTransportOrder } from '../shared/platformConnectionRecipePolicy.js';

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
  eventbrite: {
    connect: { preferred_transport: 'oauth', connector_type: 'eventbrite' },
  },
  patreon: { connect: { preferred_transport: 'oauth', connector_type: 'patreon' } },
  kofi: { connect: { preferred_transport: 'webhook', worker_key: 'kofiWebhook' } },
  buymeacoffee: { connect: { preferred_transport: 'token', worker_key: 'buyMeACoffeeApi' } },
  bluesky: { connect: { preferred_transport: 'token', worker_key: 'blueskyDirect' } },
  mastodon: { connect: { preferred_transport: 'token', worker_key: 'mastodonDirect' } },
  // SHARED (platform-managed) connector — builder's Wix site. OAuth transport
  // is platform-handled; no per-user authorization or app-owned callback.
  wix: { connect: { preferred_transport: 'oauth', connector_type: 'wix', shared: true } },
};

export function staticRecipe(platform, operation = 'connect') {
  return STATIC_CONNECTION_RECIPES[platform]?.[operation] || null;
}

export function orderedTransports(recipe) {
  // The shared policy owns both the allowlist and the 30-day evidence window.
  // A missing, future, invalid, or stale timestamp must fail closed.
  return recipeTransportOrder(recipe);
}
