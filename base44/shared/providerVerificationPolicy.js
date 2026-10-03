export function hasFreshProviderVerification(connection, now = Date.now()) {
  const verifiedAt = Date.parse(connection?.last_synced || '');
  return connection?.status === 'connected' && connection?.verification_status === 'verified' &&
    !connection?.last_error && Number.isFinite(verifiedAt) && verifiedAt <= now &&
    now - verifiedAt <= 7 * 24 * 60 * 60 * 1000;
}
