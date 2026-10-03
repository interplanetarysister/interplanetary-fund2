export const WITHDRAWAL_FEE_RATE = 0.03;
export const WITHDRAWAL_FEE_VERSION = '2026-10-withdrawal-fee-v1';
export const OBSERVATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export function evaluateCollectionSource({ connection, adapterAvailable, payoutReady, now = Date.now() }) {
  const currency = String(connection?.external_currency || '').trim().toUpperCase();
  const amount = Number(connection?.external_total || 0);
  const observedAt = connection?.last_synced || null;
  const observedTime = observedAt ? new Date(observedAt).getTime() : Number.NaN;
  const stale = !Number.isFinite(observedTime) || observedTime > now || now - observedTime > OBSERVATION_MAX_AGE_MS;
  const providerVerified = connection?.external_data_source === 'provider_verified';
  const currencyValid = /^[A-Z]{3}$/.test(currency);
  const technicallyEligible = connection?.status === 'connected' && connection?.verification_status === 'verified' &&
    providerVerified && !stale && amount > 0 && currencyValid && adapterAvailable === true;
  const eligible = technicallyEligible && payoutReady === true;
  const estimatedPlatformFee = eligible ? round2(amount * WITHDRAWAL_FEE_RATE) : 0;
  return {
    amount, currency, observedAt, stale, providerVerified, currencyValid,
    technicallyEligible, eligible, estimatedPlatformFee,
    estimatedNet: eligible ? Math.max(0, round2(amount - estimatedPlatformFee)) : 0,
  };
}

export function sameSettlementAllocation(left, right) {
  return left?.campaign_id === right?.campaign_id &&
    left?.beneficiary_user_id === right?.beneficiary_user_id &&
    left?.external_connection_id === right?.external_connection_id &&
    left?.external_observation_id === right?.external_observation_id &&
    round2(left?.amount) === round2(right?.amount) &&
    String(left?.currency || '').toUpperCase() === String(right?.currency || '').toUpperCase();
}
