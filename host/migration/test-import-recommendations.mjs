import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXPECTED_RECOMMENDATION_COUNT, RECOMMENDATION_FIELDS } from './recommendation-import-contract.mjs';

const script = fileURLToPath(new URL('./import-recommendations.mjs', import.meta.url));
const sample = Object.fromEntries(RECOMMENDATION_FIELDS.map(field => [field, `source-${field}`]));
const makeRows = () => Array.from({ length: EXPECTED_RECOMMENDATION_COUNT }, (_, i) => ({
  id: i.toString(16).padStart(24, '0'),
  title: `recommendation-${i}`,
  status: 'open',
  ...(i === 0 ? sample : {}),
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
  for (const field of RECOMMENDATION_FIELDS) {
    assert.ok(output.includes(field), `missing schema field: ${field}`);
    assert.ok(output.includes(`source-${field}`), `missing source value: ${field}`);
  }
});

test('re-import merges present fields instead of erasing previously complete content', () => {
  const output = run(makeRows());
  assert.match(output, /source_payload=coalesce\(content_shadow\.source_payload, '\{\}'::jsonb\) \|\| excluded\.source_payload/);
  assert.match(output, new RegExp(`<> ${EXPECTED_RECOMMENDATION_COUNT} `));
});

test('rejects incomplete or duplicate source snapshots', () => {
  const rows = makeRows();
  assert.throws(() => run(rows.slice(0, EXPECTED_RECOMMENDATION_COUNT - 1)));
  rows[1] = { ...rows[1], id: rows[0].id };
  assert.throws(() => run(rows));
});
