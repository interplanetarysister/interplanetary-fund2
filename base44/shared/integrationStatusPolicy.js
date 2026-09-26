export const SUPPORTED_INTEGRATION_STATUSES = new Set([
  'ACTIVE',
  'REAUTH_REQUIRED',
  'EXPIRES_SOON',
  'DISCONNECTED',
  'REVOKED',
  'MISCONFIGURED',
]);

export function normalizeIntegrationStatus(value) {
  return SUPPORTED_INTEGRATION_STATUSES.has(value) ? value : 'DISCONNECTED';
}

export function mergeIntegrationStatus(current, candidate) {
  const safeCurrent = normalizeIntegrationStatus(current);
  const safeCandidate = normalizeIntegrationStatus(candidate);
  if (safeCurrent === 'REVOKED') return 'REVOKED';
  if (safeCurrent === 'MISCONFIGURED' && safeCandidate !== 'REVOKED') return 'MISCONFIGURED';
  return safeCandidate;
}
