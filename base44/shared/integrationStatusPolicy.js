export const SUPPORTED_INTEGRATION_STATUSES = new Set([
  'ACTIVE',
  'REAUTH_REQUIRED',
  'EXPIRES_SOON',
  'DISCONNECTED',
  'REVOKED',
  'MISCONFIGURED',
  'UNKNOWN',
]);

const STATUS_FAILURE = Object.freeze({
  ACTIVE: '',
  REAUTH_REQUIRED: 'Provider authorization needs attention.',
  EXPIRES_SOON: 'Provider authorization expires soon.',
  DISCONNECTED: 'Live provider verification is unavailable.',
  REVOKED: 'Integration access is revoked.',
  MISCONFIGURED: 'Required provider configuration is missing.',
  UNKNOWN: 'Integration verification status is unknown.',
});

export function normalizeIntegrationStatus(value) {
  return SUPPORTED_INTEGRATION_STATUSES.has(value) ? value : 'UNKNOWN';
}

export function mergeIntegrationStatus(current, candidate, { providerVerified = false } = {}) {
  const safeCurrent = normalizeIntegrationStatus(current);
  const safeCandidate = normalizeIntegrationStatus(candidate);
  if (safeCurrent === 'REVOKED') return 'REVOKED';
  if (safeCurrent === 'MISCONFIGURED' && safeCandidate !== 'REVOKED') return 'MISCONFIGURED';
  if (safeCurrent === 'UNKNOWN' && !['REVOKED', 'MISCONFIGURED'].includes(safeCandidate)) return 'UNKNOWN';
  if (safeCurrent === 'REAUTH_REQUIRED' && safeCandidate !== 'ACTIVE') return 'REAUTH_REQUIRED';
  if (safeCandidate === 'ACTIVE' && !providerVerified) return 'UNKNOWN';
  return safeCandidate;
}

export function safeIntegrationFailure(status) {
  return STATUS_FAILURE[normalizeIntegrationStatus(status)];
}

export function safeIntegrationPlatform(value) {
  const platform = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(platform) ? platform : 'unknown';
}
