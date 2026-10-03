export const BROWSER_READ_CAPABILITY = 'GET_METRICS';

// Base44 currently exposes no repository-verifiable atomic reservation,
// DNS-resolution pinning, or egress-deny primitive for Browserbase runs. A
// metered run therefore remains disabled until all three controls are proven.
export const BROWSER_RUN_POLICY = Object.freeze({
  enabled: false,
  maxRunsPerOwnerPerDay: 0,
  cooldownMs: 60 * 60 * 1000,
  requiresAtomicReservation: true,
  requiresDnsPinning: true,
  requiresPrivateEgressDenial: true,
});

const APPROVED_HOSTS = Object.freeze({
  gofundme: new Set(['gofundme.com', 'www.gofundme.com']),
  kickstarter: new Set(['kickstarter.com', 'www.kickstarter.com']),
  indiegogo: new Set(['indiegogo.com', 'www.indiegogo.com']),
  fundrazr: new Set(['fundrazr.com', 'www.fundrazr.com']),
  givesendgo: new Set(['givesendgo.com', 'www.givesendgo.com']),
  spotfund: new Set(['spotfund.com', 'www.spotfund.com']),
});

export function approvedBrowserTarget(platform, value) {
  try {
    const url = new URL(String(value || ''));
    const host = url.hostname.toLowerCase();
    const allowed = APPROVED_HOSTS[String(platform || '').toLowerCase()];
    return Boolean(
      allowed &&
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === '443') &&
      url.href.length <= 2048 &&
      allowed.has(host)
    );
  } catch {
    return false;
  }
}

export function browserReadAuthorized({ user, connection, campaign, action }) {
  if (!user?.id || !connection?.id || !campaign?.id) return false;
  if (action !== BROWSER_READ_CAPABILITY) return false;
  if (connection.created_by_id !== user.id || campaign.created_by_id !== user.id) return false;
  if (connection.campaign_id !== campaign.id || connection.kind !== 'crowdfunding') return false;
  if (!approvedBrowserTarget(connection.platform, connection.external_url)) return false;
  const capabilities = Array.isArray(connection.obo_consent?.granted_capabilities)
    ? connection.obo_consent.granted_capabilities
    : [];
  return connection.obo_consent?.granted === true &&
    connection.agent_access?.shared_with_agents === true &&
    capabilities.includes(BROWSER_READ_CAPABILITY);
}

export function browserRunDecision(context) {
  if (!browserReadAuthorized(context)) return { allowed: false, reason: 'authorization_required' };
  if (!BROWSER_RUN_POLICY.enabled ||
      !context.atomicReservationAvailable ||
      !context.dnsPinningAvailable ||
      !context.privateEgressDenialProven) {
    return { allowed: false, reason: 'safe_execution_unavailable' };
  }
  return { allowed: true, reason: 'authorized' };
}
