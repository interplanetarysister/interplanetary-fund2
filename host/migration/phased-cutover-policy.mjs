// IFund phased cutover policy. Source-only; no traffic or payment mutations.
// Every phase is independently gated by its complete operational prerequisites.
export const CUTOVER_REQUIREMENTS = Object.freeze({
  shell: ['independentShellDeployed','rollbackRouteVerified','routingAndTlsVerified'],
  publicCampaigns: ['independentShellDeployed','rollbackRouteVerified','routingAndTlsVerified','campaignParityVerified','publicDataOnlyVerified'],
  privateCampaigns: ['independentShellDeployed','rollbackRouteVerified','routingAndTlsVerified','campaignParityVerified','tenantIsolationVerified','authenticatedOwnerProofVerified','consentReceiptVerified'],
  agents: ['independentShellDeployed','rollbackRouteVerified','routingAndTlsVerified','tenantIsolationVerified','authenticatedOwnerProofVerified','agentHistoryParityVerified','agentConsentVerified','redactionVerified','retryExhaustionVerified'],
  payments: ['independentShellDeployed','rollbackRouteVerified','routingAndTlsVerified','campaignParityVerified','tenantIsolationVerified','authenticatedOwnerProofVerified','paymentProviderLiveVerified','webhookAuthenticityVerified','webhookReplayProtectionVerified','ledgerParityVerified','ledgerReconciliationVerified','idempotencyVerified','withdrawalAuthorizationVerified']
});
export function releaseDecision(evidence = {}) {
  return Object.fromEntries(Object.entries(CUTOVER_REQUIREMENTS).map(([phase, requirements]) => {
    const missing = requirements.filter(key => evidence[key] !== true);
    return [phase, { allowed: missing.length === 0, missing }];
  }));
}
export function assertCutoverPhase(phase, evidence = {}) {
  if (!Object.hasOwn(CUTOVER_REQUIREMENTS, phase)) throw new Error('unknown_cutover_phase');
  const decision = releaseDecision(evidence)[phase];
  if (!decision.allowed) throw new Error('cutover_evidence_missing:' + decision.missing.join(','));
  return true;
}
