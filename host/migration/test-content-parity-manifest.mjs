import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGED_CONTENT, OTHER_STAGED, SOURCE_COUNTS, migrationStatus } from './content-parity-manifest.mjs';

test('default migration status uses the same staged counts as the parity checker', () => {
  for (const [entity, sourceCount] of Object.entries(SOURCE_COUNTS)) {
    const expected = STAGED_CONTENT[entity] ?? OTHER_STAGED[entity] ?? 0;
    const result = migrationStatus(entity);
    assert.equal(result.sourceCount, sourceCount, entity);
    assert.equal(result.destinationCount, expected, entity);
    assert.equal(result.missingCount, Math.max(0, sourceCount - expected), entity);
  }
});

test('externally staged campaign entities use the shared manifest counts', () => {
  assert.deepEqual(OTHER_STAGED, { Campaign: 27, CampaignUpdate: 10, PlatformConnection: 32 });
  assert.equal(migrationStatus('Campaign').destinationCount, 27);
  assert.equal(migrationStatus('CampaignUpdate').destinationCount, 10);
  assert.equal(migrationStatus('PlatformConnection').destinationCount, 32);
});

test('unknown entity types and invalid destination counts are rejected', () => {
  assert.throws(() => migrationStatus('NotAnEntity'), /unknown_entity_type/);
  assert.throws(() => migrationStatus('Campaign', -1), /invalid_destination_count/);
});
