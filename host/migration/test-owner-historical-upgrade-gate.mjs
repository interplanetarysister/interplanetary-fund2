import test from 'node:test';
import assert from 'node:assert/strict';
import { upgradeHistoricalOwnerSessions } from './owner-historical-upgrade-gate.mjs';

const SOURCE = '6a67a778342a8fe05ee79cbb';
const DEST = 'bba16ddd-8531-4ed2-84ca-5de48fc8a8c1';
const EMAIL = 'owner@example.org';
const T = Date.parse('2026-10-24T23:37:00Z');
const source = { verified: true, active: true, id: SOURCE, email: EMAIL };
const destination = { verified: true, id: DEST, email: EMAIL, email_confirmed_at: '2026-10-24T00:00:00Z' };
const mapping = { source_owner_id: SOURCE, source_email: EMAIL,
  verification_state: 'verified', destination_auth_uid: DEST,
  candidate_auth_uid: DEST, candidate_match_method: 'confirmed_exact_email' };
const goodResult = { upgraded: true, source_owner_id: SOURCE,
  destination_auth_uid: DEST, verification_state: 'verified' };
const base = (overrides = {}) => {
  const calls = { lookup: 0, commit: 0 };
  return { calls, args: {
    verifySourceSession: async () => source,
    verifyDestinationSession: async () => destination,
    loadSourceOwner: async () => { calls.lookup++; return mapping; },
    upgradeHistoricalLink: async () => { calls.commit++; return goodResult; },
    consentNonceSha256: 'a'.repeat(64),
    consentOrigin: 'https://interplanetaryfund.com',
    consentExplicit: true,
    now: () => T,
    ...overrides,
  } };
};

test('only live dual-provider matching owner sessions can atomically upgrade historical candidate', async () => {
  const { args, calls } = base({ upgradeHistoricalLink: async p => {
    calls.commit++;
    assert.deepEqual(Object.keys(p).sort(), [
      'consentNonceSha256','consentOrigin','destinationAuthUid','destinationSessionCheckedAt',
      'expectedCandidateMethod','expectedEmail','expectedState','sourceOwnerId','sourceSessionCheckedAt',
    ].sort());
    assert.equal(p.expectedCandidateMethod, 'confirmed_exact_email');
    assert.equal(p.expectedState, 'verified');
    assert.equal(p.destinationAuthUid, DEST);
    assert.equal(p.sourceOwnerId, SOURCE);
    assert.equal(p.consentOrigin, 'https://interplanetaryfund.com');
    return goodResult;
  }});
  assert.deepEqual(await upgradeHistoricalOwnerSessions(args), { ok: true, upgraded: true });
  assert.equal(calls.lookup, 1);
  assert.equal(calls.commit, 1);
});

test('missing explicit consent, nonce digest or allowed origin blocks provider calls', async () => {
  for (const change of [
    { consentExplicit: false }, { consentExplicit: undefined },
    { consentNonceSha256: 'invalid' }, { consentOrigin: 'https://evil.example' },
  ]) {
    let providers = 0;
    const { args, calls } = base({ verifySourceSession: async () => { providers++; return source; }, ...change });
    assert.equal((await upgradeHistoricalOwnerSessions(args)).reason, 'consent_required');
    assert.equal(providers, 0); assert.equal(calls.commit, 0);
  }
});

test('missing or failed source session prevents database lookup or upgrade', async () => {
  for (const bad of [{ ...source, verified: false }, { ...source, active: false },
    { ...source, id: 'wrong' }, { ...source, email: '' }]) {
    const { args, calls } = base({ verifySourceSession: async () => bad });
    assert.equal((await upgradeHistoricalOwnerSessions(args)).reason, 'source_authentication_required');
    assert.equal(calls.lookup, 0); assert.equal(calls.commit, 0);
  }
});

test('destination verification requires live session, confirmed email and UUID', async () => {
  for (const bad of [{ ...destination, verified: false }, { ...destination, id: 'wrong' },
    { ...destination, email_confirmed_at: null }, { ...destination, email: '' }]) {
    const { args, calls } = base({ verifyDestinationSession: async () => bad });
    assert.equal((await upgradeHistoricalOwnerSessions(args)).reason, 'destination_authentication_required');
    assert.equal(calls.lookup, 0); assert.equal(calls.commit, 0);
  }
});

test('cross-owner destination email mismatch prevents lookup and upgrade', async () => {
  const { args, calls } = base({ verifyDestinationSession: async () => ({ ...destination, email: 'other@example.org' }) });
  assert.equal((await upgradeHistoricalOwnerSessions(args)).reason, 'identity_mismatch');
  assert.equal(calls.lookup, 0); assert.equal(calls.commit, 0);
});

test('candidate method, mapped owner and destination UID must all match exactly', async () => {
  for (const change of [
    { candidate_match_method: null }, { candidate_match_method: 'unverified' },
    { candidate_auth_uid: null }, { destination_auth_uid: null },
    { destination_auth_uid: '00000000-0000-0000-0000-000000000000' },
    { verification_state: 'awaiting_destination_login' },
  ]) {
    const { args, calls } = base({ loadSourceOwner: async () => ({ ...mapping, ...change }) });
    assert.equal((await upgradeHistoricalOwnerSessions(args)).reason, 'historical_mapping_conflict');
    assert.equal(calls.commit, 0);
  }
});

test('source owner ID or source email mismatch blocks upgrade', async () => {
  for (const change of [{ source_owner_id: 'ffffffffffffffffffffffff' }, { source_email: 'other@example.org' }]) {
    const { args, calls } = base({ loadSourceOwner: async () => ({ ...mapping, ...change }) });
    assert.equal((await upgradeHistoricalOwnerSessions(args)).reason, 'source_owner_not_found');
    assert.equal(calls.commit, 0);
  }
});

test('provider and database failures sanitize errors and fail closed', async () => {
  const badSource = base({ verifySourceSession: async () => { throw Error('secret-bearer'); } });
  assert.equal((await upgradeHistoricalOwnerSessions(badSource.args)).reason, 'identity_provider_unavailable');
  const badLookup = base({ loadSourceOwner: async () => { throw Error('secret-key'); } });
  assert.equal((await upgradeHistoricalOwnerSessions(badLookup.args)).reason, 'storage_unavailable');
  const badCommit = base({ upgradeHistoricalLink: async () => { throw Error('service-role-secret'); } });
  assert.equal((await upgradeHistoricalOwnerSessions(badCommit.args)).reason, 'storage_unavailable');
});

test('stale verification is not reused for an upgrade', async () => {
  let now = T;
  const { args, calls } = base({
    now: () => now,
    loadSourceOwner: async () => { now += 61_000; return mapping; },
  });
  assert.equal((await upgradeHistoricalOwnerSessions(args)).reason, 'provider_proof_expired');
  assert.equal(calls.commit, 0);
});

test('malformed or conflicting atomic upgrade result is rejected', async () => {
  for (const result of [null, { upgraded: false }, { ...goodResult, destination_auth_uid: 'wrong' },
    { ...goodResult, source_owner_id: 'wrong' }, { ...goodResult, verification_state: 'awaiting_destination_login' }]) {
    const { args } = base({ upgradeHistoricalLink: async () => result });
    assert.equal((await upgradeHistoricalOwnerSessions(args)).reason, 'historical_mapping_conflict');
  }
});
