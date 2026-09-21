import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyReleaseContract } from './verify-node22-release-contract.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'node22-release-contract-'));
  mkdirSync(join(root, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ engines: { node: '22.x' } }));
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify({
    packages: {
      '': { engines: { node: '22.x' } },
      'node_modules/@types/node': { version: '22.20.2' },
    },
  }));
  writeFileSync(join(root, '.node-version'), '22\n');
  writeFileSync(join(root, '.nvmrc'), '22\n');
  writeFileSync(join(root, '.github', 'workflows', 'quality.yml'), 'jobs:\n  test:\n    steps:\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n');
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

expect('valid fixture', () => {}, (errors) => errors.length === 0);
expect('missing workflow inventory', (root) => rmSync(join(root, '.github', 'workflows'), { recursive: true }), (errors) => errors.some((error) => error === 'missing:.github/workflows'));
expect('empty workflow inventory', (root) => rmSync(join(root, '.github', 'workflows', 'quality.yml')), (errors) => errors.some((error) => error.includes('workflow inventory')));
expect('empty workflow', (root) => writeFileSync(join(root, '.github', 'workflows', 'quality.yml'), ''), (errors) => errors.some((error) => error === 'empty:.github/workflows/quality.yml'));
expect('malformed package', (root) => writeFileSync(join(root, 'package.json'), '{'), (errors) => errors.some((error) => error.startsWith('malformed:package.json')));
expect('malformed lockfile', (root) => writeFileSync(join(root, 'package-lock.json'), '{'), (errors) => errors.some((error) => error.startsWith('malformed:package-lock.json')));
expect('commented declaration ignored', (root) => writeFileSync(join(root, '.github', 'workflows', 'quality.yml'), '# node-version: 24\n'), (errors) => errors.some((error) => error.includes('actions/setup-node')) && !errors.some((error) => error.includes('pins 24')));
expect('block scalar declaration ignored', (root) => writeFileSync(join(root, '.github', 'workflows', 'quality.yml'), 'description: |\n  node-version: 24\n'), (errors) => errors.some((error) => error.includes('actions/setup-node')) && !errors.some((error) => error.includes('pins 24')));
expect('malformed workflow rejected', (root) => writeFileSync(join(root, '.github', 'workflows', 'quality.yml'), 'jobs: [\n'), (errors) => errors.some((error) => error.startsWith('malformed:.github/workflows/quality.yml')));
expect('stray node-version does not satisfy inventory', (root) => writeFileSync(join(root, '.github', 'workflows', 'quality.yml'), 'env:\n  node-version: 22\n'), (errors) => errors.some((error) => error.includes('actions/setup-node')));
expect('setup-node without pin rejected', (root) => writeFileSync(join(root, '.github', 'workflows', 'quality.yml'), 'jobs:\n  test:\n    steps:\n      - uses: actions/setup-node@v4\n'), (errors) => errors.some((error) => error.includes('pins <missing>')));
expect('case-variant setup-node cannot bypass contract', (root) => writeFileSync(join(root, '.github', 'workflows', 'quality.yml'), 'jobs:\n  valid:\n    steps:\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n  invalid:\n    steps:\n      - uses: Actions/Setup-Node@v4\n'), (errors) => errors.some((error) => error.includes('pins <missing>')));
expect('dynamic setup-node pin rejected', (root) => writeFileSync(join(root, '.github', 'workflows', 'quality.yml'), 'jobs:\n  test:\n    steps:\n      - uses: actions/setup-node@v4\n        with:\n          node-version: ${{ matrix.node }}\n'), (errors) => errors.some((error) => error.includes('expected literal 22')));
expect('active incompatible pin rejected', (root) => writeFileSync(join(root, '.github', 'workflows', 'quality.yml'), 'jobs:\n  test:\n    steps:\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 24\n'), (errors) => errors.some((error) => error.includes('pins 24')));

const runtimeGate = readFileSync(new URL('./require-node22.mjs', import.meta.url), 'utf8');
assert.match(runtimeGate, /const SUPPORTED = \[22\];/, 'runtime preflight must allow only Node 22');
assert.doesNotMatch(runtimeGate, /SUPPORTED\s*=\s*\[[^\]]*20/, 'runtime preflight must reject Node 20');

console.log('Node 22 release contract negative cases passed.');
