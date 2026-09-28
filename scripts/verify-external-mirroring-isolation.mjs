import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  EXTERNAL_MIRRORING_DISABLED_REASON,
  runExternalMirroring,
} from '../base44/shared/externalMirroringPolicy.js';

const entry = fs.readFileSync('base44/functions/mirrorExternalPosts/entry.ts', 'utf8');
assert.match(entry, /runExternalMirroring\(\)/);
assert.doesNotMatch(entry, /connectors\.getConnection/);
assert.doesNotMatch(entry, /entities\.SocialPost\.create/);

const owners = [
  {
    id: 'connection-owner-a',
    created_by_id: 'owner-a',
    platform: 'discord',
    status: 'connected',
    verification_status: 'verified',
    last_synced: '2026-09-28T12:00:00.000Z',
    obo_consent: { granted: true },
    agent_access: { shared_with_agents: true, automation_enabled: true },
  },
  {
    id: 'connection-owner-b',
    created_by_id: 'owner-b',
    platform: 'discord',
    status: 'connected',
    verification_status: 'verified',
    last_synced: '2026-09-28T12:00:00.000Z',
    obo_consent: { granted: true },
    agent_access: { shared_with_agents: true, automation_enabled: true },
  },
];

for (const variant of [
  owners,
  owners.map((connection) => ({ ...connection, obo_consent: { granted: false } })),
  owners.map((connection) => ({ ...connection, agent_access: { shared_with_agents: true, automation_enabled: false } })),
  owners.map((connection) => ({ ...connection, verification_status: 'unverified' })),
  owners.map((connection) => ({ ...connection, last_synced: '2026-08-01T00:00:00.000Z' })),
]) {
  let connectionReads = 0;
  let providerFetches = 0;
  let socialWrites = 0;
  const result = await runExternalMirroring({
    getConnections: async () => { connectionReads += 1; return variant; },
    fetchProviderPosts: async () => { providerFetches += 1; return [{ external_post_id: 'shared-message' }]; },
    createSocialPost: async () => { socialWrites += 1; },
  });

  assert.equal(result.disabled, true);
  assert.equal(result.reason, EXTERNAL_MIRRORING_DISABLED_REASON);
  assert.equal(result.mirrored, 0);
  assert.equal(connectionReads, 0, 'disabled mirroring must not read tenant connections');
  assert.equal(providerFetches, 0, 'disabled mirroring must not fetch shared provider data');
  assert.equal(socialWrites, 0, 'disabled mirroring must not create cross-owner posts');
}

console.log('External mirroring fails closed before tenant reads, provider fetches, or SocialPost writes.');
