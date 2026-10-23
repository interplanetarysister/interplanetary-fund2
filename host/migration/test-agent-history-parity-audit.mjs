import assert from 'node:assert/strict';
import test from 'node:test';
import { auditAgentHistory } from './agent-history-parity-audit.mjs';
const campaigns = [{ id: 'c1', created_by_id: 'o1' }, { id: 'c2', created_by_id: 'o2' }];
const activity = { id: 'a1', campaign_id: 'c1', owner_user_id: 'o1', status: 'pending', description: 'PRIVATE CUSTOMER DETAILS' };
const delegation = { id: 'd1', campaign_id: 'c2', owner_user_id: 'o2', status: 'waiting_user', consent_version: 'v1', retry_count: 0, max_retries: 3, objective: 'SECRET OBJECTIVE' };
const audit = (activities = [activity], delegations = [delegation], cs = campaigns) => auditAgentHistory({ campaigns: cs, activities, delegations });

test('reports aggregates without exposing source identifiers or content', () => {
  const result = audit();
  assert.equal(result.activityCount, 1);
  assert.equal(result.delegationCount, 1);
  assert.equal(result.ownerMismatches, 0);
  assert.equal(result.executionAllowed, false);
  const serialized = JSON.stringify(result);
  for (const sensitive of ['PRIVATE CUSTOMER DETAILS', 'SECRET OBJECTIVE', 'o1', 'o2', 'c1', 'c2', 'a1', 'd1'])
    assert.equal(serialized.includes(sensitive), false);
});
test('user/admin scoped activity references are not misclassified as missing campaigns', () => {
  const result = audit([
    { ...activity, id: 'a2', campaign_id: 'user:abc' },
    { ...activity, id: 'a3', campaign_id: 'admin:queue' },
  ], []);
  assert.deepEqual(result.scopedReferences, { user: 1, admin: 1 });
  assert.equal(result.missingCampaignReferences, 0);
});
test('unknown campaign references remain blockers, not silently reclassified', () => {
  assert.equal(audit([{ ...activity, campaign_id: 'unknown-campaign' }], []).missingCampaignReferences, 1);
});
test('cross-owner campaign references are flagged without exposing owner IDs', () => {
  const result = audit([{ ...activity, owner_user_id: 'o2' }], []);
  assert.equal(result.ownerMismatches, 1);
});
test('history from unknown owner is flagged', () => {
  assert.equal(audit([{ ...activity, owner_user_id: 'outside' }], []).unknownOwnerReferences, 1);
});
test('missing consent version blocks automatic execution', () => {
  const result = audit([], [{ ...delegation, consent_version: undefined }]);
  assert.equal(result.missingConsentVersion, 1);
  assert.equal(result.executionAllowed, false);
});
test('retry limits are classified without restarting work', () => {
  const result = audit([], [
    { ...delegation, id: 'd2', retry_count: 3, max_retries: 3 },
    { ...delegation, id: 'd3', retry_count: 4, max_retries: 3 },
    { ...delegation, id: 'd4', retry_count: 1, max_retries: undefined },
  ]);
  assert.equal(result.atRetryLimit, 1);
  assert.equal(result.overRetryLimit, 1);
  assert.equal(result.missingRetryLimit, 1);
});
test('duplicate history IDs are reported', () => {
  assert.equal(audit([activity], [{ ...delegation, id: 'a1' }]).duplicateRecordIds, 1);
});
test('source statuses do not grant execution authority', () => {
  const result = audit([{ ...activity, status: 'approved' }], [{ ...delegation, status: 'in_progress' }]);
  assert.equal(result.migrationDisposition, 'quarantine_only');
  assert.equal(result.executionAllowed, false);
});
test('empty or malformed collections fail closed', () => {
  const result = auditAgentHistory({ campaigns: null, activities: {}, delegations: undefined });
  assert.equal(result.executionAllowed, false);
  assert.equal(result.activityCount, 0);
  assert.equal(result.delegationCount, 0);
});
