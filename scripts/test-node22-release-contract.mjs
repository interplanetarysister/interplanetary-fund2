import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyReleaseContract } from './verify-node22-release-contract.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'runtime-release-contract-'));
  mkdirSync(join(root, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ engines: { node: '>=20 <23' } }));
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ packages: { '': { engines: { node: '>=20 <23' } } } }));
  writeFileSync(join(root, '.node-version'), '20\n');
  writeFileSync(join(root, '.nvmrc'), '20\n');
  writeFileSync(join(root, '.github', 'workflows', 'quality.yml'), 'jobs:\n  test:\n    steps:\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n');
  return root;
}

function expect(name, mutate, expected) {
  const root = fixture();
  try {
    mutate(root);
    const errors = verifyReleaseContract(root);
    if (!expected(errors)) throw new Error(`${name} failed; errors: ${JSON.stringify(errors)}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

expect('valid Node 20 baseline', () => {}, (errors) => errors.length === 0);
expect('Node 22 compatibility may coexist', (root) => {
  writeFileSync(join(root, '.github', 'workflows', 'quality.yml'), 'jobs:\n  base44:\n    steps:\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n  compatibility:\n    steps:\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n');
}, (errors) => errors.length === 0);
expect('Node-22-only regression rejected', (root) => {
  writeFileSync(join(root, '.github', 'workflows', 'quality.yml'), 'jobs:\n  test:\n    steps:\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n');
}, (errors) => errors.some((error) => error.includes('do not revert to Node-22-only')));
expect('Node 24 rejected', (root) => {
  writeFileSync(join(root, '.github', 'workflows', 'quality.yml'), 'jobs:\n  test:\n    steps:\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 24\n');
}, (errors) => errors.some((error) => error.includes('expected Node 20 or Node 22')));
expect('Node-version file cannot revert to 22', (root) => writeFileSync(join(root, '.node-version'), '22\n'), (errors) => errors.some((error) => error.includes('.node-version')));
expect('nvm baseline cannot revert to 22', (root) => writeFileSync(join(root, '.nvmrc'), '22\n'), (errors) => errors.some((error) => error.includes('.nvmrc')));
expect('missing workflow inventory', (root) => rmSync(join(root, '.github', 'workflows'), { recursive: true }), (errors) => errors.some((error) => error === 'missing:.github/workflows'));
expect('malformed package', (root) => writeFileSync(join(root, 'package.json'), '{'), (errors) => errors.some((error) => error.startsWith('malformed:package.json')));
expect('malformed workflow rejected', (root) => writeFileSync(join(root, '.github', 'workflows', 'quality.yml'), 'jobs: [\n'), (errors) => errors.some((error) => error.startsWith('malformed:.github/workflows/quality.yml')));

const runtimeGate = readFileSync(new URL('./require-node22.mjs', import.meta.url), 'utf8');
assert.match(runtimeGate, /const SUPPORTED = \[20, 22\];/, 'runtime preflight must allow Node 20 and Node 22');
assert.doesNotMatch(runtimeGate, /SUPPORTED\s*=\s*\[[^\]]*24/, 'runtime preflight must reject Node 24');

console.log('Node 20/22 runtime contract negative cases passed.');
