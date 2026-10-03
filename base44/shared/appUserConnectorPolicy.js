const APP_READ = ['read_account', 'read_resources'];
const MESSAGING = ['read_account', 'read_messages', 'reply_message'];
const SOCIAL = [
  'read_account', 'read_resources',
  'create_post', 'edit_post', 'delete_own_post', 'upload_media',
  'read_interactions', 'comment', 'reply_comment',
  'read_messages', 'reply_message', 'read_analytics',
];
const CROWDFUNDING_READ = [
  'read_account', 'read_resources', 'read_campaign', 'read_analytics',
  'read_donations', 'read_payments', 'read_transactions',
  'subscribe_events', 'reconcile_external_funds', 'settlement_status',
];

const POLICIES = {
  gmail: MESSAGING,
  googledrive: APP_READ,
  googlecalendar: APP_READ,
  google_contacts: APP_READ,
  google_photos: APP_READ,
  googlesheets: APP_READ,
  googledocs: APP_READ,
  googleforms: APP_READ,
  googletasks: APP_READ,
  slack: MESSAGING,
  notion: APP_READ,
  outlook: MESSAGING,
  microsoft_teams: MESSAGING,
  one_drive: APP_READ,
  dropbox: APP_READ,
  github: APP_READ,
  gitlab: APP_READ,
  linkedin: SOCIAL,
  facebook: SOCIAL,
  instagram: SOCIAL,
  discord: SOCIAL,
  tiktok: SOCIAL,
  threads: SOCIAL,
  x: SOCIAL,
  pinterest: SOCIAL,
  reddit: SOCIAL,
  youtube: SOCIAL,
  patreon: CROWDFUNDING_READ,
};

export function connectorPolicy(platform) {
  return { requestedCapabilities: [...(POLICIES[String(platform || '').toLowerCase()] || [])] };
}

export function providerCapabilities(oauth) {
  const raw = oauth?.capabilities || oauth?.grantedCapabilities || oauth?.scopes || oauth?.scope;
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[ ,]+/)
      : [];
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

export function connectorAuthorizationStatus(oauth) {
  return {
    authorization_present: Boolean(oauth?.accessToken),
    connected: false,
    provider_verified: false,
    configured: true,
  };
}

export function buildOAuthAuthorizationState({
  platform,
  kind,
  oauth,
  sharedAgentConsent = false,
  existing = null,
  now = new Date().toISOString(),
}) {
  const key = String(platform || '').toLowerCase();
  const consentGranted = sharedAgentConsent === true;
  const confirmed = providerCapabilities(oauth);
  const requestedCapabilities = connectorPolicy(key).requestedCapabilities;
  const confirmedRequested = requestedCapabilities.filter((capability) => confirmed.includes(capability));
  const history = Array.isArray(existing?.history) ? existing.history : [];

  return {
    platform: key,
    kind,
    display_name: existing?.display_name || key,
    external_url: existing?.external_url || '',
    // Sharing a connection with agents is not automation consent. Automation
    // requires a separate, post-verification authorization path.
    automation_mode: 'manual',
    obo_consent: {
      granted: consentGranted,
      granted_at: consentGranted ? now : null,
      permission_version: '2026-09-comprehensive-platform-v1',
      requested_capabilities: requestedCapabilities,
      // Desired capabilities never become authority. Only the intersection of
      // provider-reported capabilities and this provider's allowlist is kept.
      granted_capabilities: consentGranted ? confirmedRequested : [],
      provider_capabilities: confirmed,
    },
    agent_access: {
      shared_with_agents: consentGranted,
      automation_enabled: false,
    },
    // OAuth token presence proves authorization material exists, not that the
    // provider is reachable or that any operation succeeded.
    status: 'disconnected',
    verification_status: 'unverified',
    capability_status: confirmed.length ? 'confirmed' : 'unknown',
    // Reauthorization invalidates the provenance of any prior provider check.
    // Existing values remain historical owner-reported context until a fresh
    // provider call verifies them again.
    external_data_source: 'owner_reported',
    last_error: 'Provider authorization saved; live verification is still required.',
    history: [...history, {
      at: now,
      event: 'oauth_authorized',
      detail: confirmed.length
        ? `Provider authorization saved; ${confirmed.length} provider-reported capabilities recorded; live verification required`
        : 'Provider authorization saved; detailed provider capabilities remain unknown; live verification required',
    }].slice(-30),
  };
}
