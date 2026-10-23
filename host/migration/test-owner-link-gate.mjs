import assert from 'node:assert/strict';
import test from 'node:test';
import { linkVerifiedOwnerSessions } from './owner-link-gate.mjs';
const source = { verified: true, active: true, id: '6a67a778342a8fe05ee79cbb', email: 'Owner@Example.org' };
const destination = { verified: true, id: 'bba16ddd-8531-4ed2-84ca-5de48fc8a8c1', email: 'owner@example.org', email_confirmed_at: '2026-10-23T00:00:00Z' };
const mapping = { source_owner_id: source.id, source_email: source.email, verification_state: 'awaiting_destination_login', destination_auth_uid: null, candidate_auth_uid: destination.id };
const factory = (overrides = {}) => ({
  verifySourceSession: async () => source,
  verifyDestinationSession: async () => destination,
  loadSourceOwner: async () => mapping,
  commitVerifiedLink: async ({sourceOwnerId, destinationAuthUid}) => ({linked:true, source_owner_id:sourceOwnerId, destination_auth_uid:destinationAuthUid, verification_state:'verified'}),
  ...overrides,
});
test('two live authenticated principals can link via atomic write', async () => {
  assert.deepEqual(await linkVerifiedOwnerSessions(factory()), {ok:true, linked:true, alreadyLinked:false});
});
test('candidate hint alone is not authorization', async () => {
  const result = await linkVerifiedOwnerSessions(factory({verifySourceSession:async()=>({...source,verified:false})}));
  assert.equal(result.reason,'source_authentication_required');
});
test('destination email confirmation is mandatory', async () => {
  const result = await linkVerifiedOwnerSessions(factory({verifyDestinationSession:async()=>({...destination,email_confirmed_at:null})}));
  assert.equal(result.reason,'destination_authentication_required');
});
test('cross-email claims fail', async () => {
  const result = await linkVerifiedOwnerSessions(factory({verifyDestinationSession:async()=>({...destination,email:'attacker@example.org'})}));
  assert.equal(result.reason,'identity_mismatch');
});
test('source mapping mismatch fails', async () => {
  const result = await linkVerifiedOwnerSessions(factory({loadSourceOwner:async()=>({...mapping,source_owner_id:'aaaaaaaaaaaaaaaaaaaaaaaa'})}));
  assert.equal(result.reason,'source_owner_not_found');
});
test('existing different owner link fails', async () => {
  const result = await linkVerifiedOwnerSessions(factory({loadSourceOwner:async()=>({...mapping,verification_state:'verified',destination_auth_uid:'11111111-1111-1111-1111-111111111111'})}));
  assert.equal(result.reason,'link_conflict');
});
test('same verified link is idempotent', async () => {
  const result = await linkVerifiedOwnerSessions(factory({loadSourceOwner:async()=>({...mapping,verification_state:'verified',destination_auth_uid:destination.id})}));
  assert.deepEqual(result,{ok:true,linked:true,alreadyLinked:true});
});
test('atomic compare-and-set failure does not claim success', async () => {
  const result = await linkVerifiedOwnerSessions(factory({commitVerifiedLink:async()=>({linked:false})}));
  assert.equal(result.reason,'link_conflict');
});
test('storage outage fails closed', async () => {
  const result = await linkVerifiedOwnerSessions(factory({loadSourceOwner:async()=>{throw Error('sensitive database error')}}));
  assert.deepEqual(result,{ok:false,linked:false,reason:'storage_unavailable'});
});
test('inactive source account fails', async () => {
  const result = await linkVerifiedOwnerSessions(factory({verifySourceSession:async()=>({...source,active:false})}));
  assert.equal(result.reason,'source_authentication_required');
});
test('malformed destination id fails', async () => {
  const result = await linkVerifiedOwnerSessions(factory({verifyDestinationSession:async()=>({...destination,id:'not-a-uuid'})}));
  assert.equal(result.reason,'destination_authentication_required');
});
test('missing adapters fail closed', async () => {
  assert.deepEqual(await linkVerifiedOwnerSessions(),{ok:false,linked:false,reason:'not_configured'});
});
test('provider failures never reveal session tokens or personal data', async () => {
  const result = await linkVerifiedOwnerSessions(factory({verifySourceSession:async()=>{throw Error('secret bearer token Owner@Example.org')}}));
  assert.equal(result.reason,'identity_provider_unavailable');
  assert.doesNotMatch(JSON.stringify(result),/bearer|owner@example|secret/i);
});
