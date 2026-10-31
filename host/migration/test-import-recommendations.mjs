import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./import-recommendations.mjs', import.meta.url));
const makeRows = () => Array.from({ length: 836 }, (_, i) => ({
  id: i.toString(16).padStart(24, '0'),
  title: `recommendation-${i}`,
  status: 'open',
  ...(i === 0 ? {
    created_by_id: 'creator-001',
    created_date: '2026-10-24T01:00:00.000Z',
    updated_date: '2026-10-25T01:00:00.000Z',
    campaign_id: 'campaign-001',
    campaign_title: 'Restoration campaign',
    owner_user_id: 'owner-001',
    description: 'Full recommendation description',
    reasoning: 'Reasoning grounded in the source record',
    evidence: 'Evidence from the source record',
    confidence: 'high',
    expected_impact: 'Expected impact from the source record',
    estimated_effort: 'Two days',
    agent: 'strategy',
  } : {}),
}));

function run(rows) {
  const dir = mkdtempSync(join(tmpdir(), 'ifund-recommendations-'));
  const file = join(dir, 'recommendations.json');
  try {
    writeFileSync(file, JSON.stringify(rows));
    return execFileSync(process.execPath, [script, file], { encoding: 'utf8' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('imports every Recommendation schema field and source ownership metadata', () => {
  const output = run(makeRows());
  for (const value of [
    'creator-001', '2026-10-24T01:00:00.000Z', '2026-10-25T01:00:00.000Z',
    'campaign-001', 'Restoration campaign', 'owner-001',
    'Full recommendation description', 'Reasoning grounded in the source record',
    'Evidence from the source record', 'high',
    'Expected impact from the source record', 'Two days', 'strategy', 'open',
  ]) assert.ok(output.includes(value), `missing imported source value: ${value}`);
});

test('re-import merges present fields instead of erasing previously complete content', () => {
  const output = run(makeRows());
  assert.match(output, /source_payload=coalesce\(content_shadow\.source_payload, '\{\}'::jsonb\) \|\| excluded\.source_payload/);
});

test('rejects incomplete or duplicate source snapshots', () => {
  const rows = makeRows();
  assert.throws(() => run(rows.slice(0, 835)));
  rows[1] = { ...rows[1], id: rows[0].id };
  assert.throws(() => run(rows));
});
