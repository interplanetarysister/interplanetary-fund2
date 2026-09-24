import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const sync = read('base44/functions/syncGitHub/entry.ts');
const panel = read('src/components/admin/IntegrationDetailPanel.jsx');
const runbook = read('docs/deferred-base44-workflows.md');
const pkg = JSON.parse(read('package.json'));
const nodeVersion = read('.node-version').trim();
const nvmrc = read('.nvmrc').trim();
const quality = read('.github/workflows/quality-gates.yml');

assert.equal(nodeVersion, '20', '.node-version must preserve the Base44 Node 20 compatibility baseline');
assert.equal(nvmrc, '20', '.nvmrc must preserve the Base44 Node 20 compatibility baseline');
assert.equal(pkg.engines?.node, '>=20 <23', 'package engine must preserve Node 20 and Node 22 compatibility');
assert.match(quality, /node-version:\s*20\b/, 'quality gates must retain the Base44 Node 20 compatibility lane');
assert.match(quality, /node-version:\s*22\b/, 'quality gates must retain the Node 22 release lane');

assert.equal(
  existsSync(new URL('../base44/workflows/GitHub Sync.jsonc', import.meta.url)),
  false,
  'scheduled GitHub sync must remain absent until Base44 exposes a server-verifiable workflow identity'
);
assert.match(sync, /const REPO = 'interplanetarysister\/interplanetary-fund2'/);
assert.match(sync, /const BRANCH = 'main'/);
assert.match(sync, /if \(!user\) return Response\.json\(\{ error: 'Unauthorized' \}/);
assert.match(sync, /user\.role !== 'admin'/);
assert.doesNotMatch(sync, /initiator_type|isWorkflow/,
  'caller-supplied workflow labels must never bypass authentication');
assert.match(sync, /assertPlatformAccess\(sr, 'github'\)/);
assert.match(sync, /GitHub OAuth connector not authorized/);
assert.doesNotMatch(sync, /Deno\.Command|child_process|execSync|spawnSync/,
  'Base44 sync must use the provider API, not shell git');

assert.match(panel, /base44\.functions\.invoke\("syncGitHub", \{ direction \}\)/,
  'authenticated admin health verification must remain available');
assert.match(panel, /do not move files, create commits, or replace Base44/i,
  'the admin UI must describe the advisory check truthfully');
assert.doesNotMatch(panel, /Pull fast-forwards|Push sends Base44 commits/,
  'the UI must not claim deferred source transfer is implemented');

assert.match(runbook, /scheduled GitHub workflow definition is intentionally absent/i);
assert.match(runbook, /caller-supplied[\s\S]*initiator_type/i);
assert.match(runbook, /authenticated\s+administrator/i);
assert.match(runbook, /server-verifiable workflow identity/i);

console.log('Base44 sync fail-closed contract passed.');
