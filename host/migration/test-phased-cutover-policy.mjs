import test from 'node:test';
import assert from 'node:assert/strict';
import { CUTOVER_REQUIREMENTS, releaseDecision, assertCutoverPhase } from './phased-cutover-policy.mjs';

const completeEvidence = Object.fromEntries(
  [...new Set(Object.values(CUTOVER_REQUIREMENTS).flat())].map(key => [key, true]),
);

test('every phase is independently blocked when evidence is absent', () => {
  for (const [phase, requirements] of Object.entries(CUTOVER_REQUIREMENTS)) {
    const result = releaseDecision({})[phase];
    assert.equal(result.allowed, false, phase);
    assert.deepEqual(result.missing, requirements, phase);
  }
});

test('agents phase independently requires routing and TLS evidence', () => {
  const evidence = { ...completeEvidence };
  delete evidence.routingAndTlsVerified;
  assert.equal(releaseDecision(evidence).agents.allowed, false);
  assert.ok(releaseDecision(evidence).agents.missing.includes('routingAndTlsVerified'));
});

test('payments phase independently requires tenant, owner, campaign, webhook and ledger evidence', () => {
  for (const key of ['routingAndTlsVerified','campaignParityVerified','tenantIsolationVerified',
    'authenticatedOwnerProofVerified','webhookAuthenticityVerified','webhookReplayProtectionVerified',
    'ledgerReconciliationVerified']) {
    const evidence = { ...completeEvidence };
    delete evidence[key];
    assert.equal(releaseDecision(evidence).payments.allowed, false, key);
    assert.ok(releaseDecision(evidence).payments.missing.includes(key), key);
  }
});

test('complete evidence permits each phase independently', () => {
  for (const phase of Object.keys(CUTOVER_REQUIREMENTS)) {
    assert.equal(releaseDecision(completeEvidence)[phase].allowed, true, phase);
    assert.equal(assertCutoverPhase(phase, completeEvidence), true, phase);
  }
});

test('unknown phase is rejected', () => {
  assert.throws(() => assertCutoverPhase('unknown', completeEvidence), /unknown_cutover_phase/);
});
