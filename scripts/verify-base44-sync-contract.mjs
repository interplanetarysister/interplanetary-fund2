import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const sync = read('base44/functions/syncGitHub/entry.ts');
const panel = read('src/components/admin/IntegrationDetailPanel.jsx');
const adminPage = read('src/pages/IntegrationsAdmin.jsx');
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

function assertNoWorkflowInvocation(entries) {
  for (const [name, source] of entries) {
    assert.doesNotMatch(
      source,
      /\bsyncGitHub\b/,
      name + ' must not invoke syncGitHub until workflow identity is server-verifiable'
    );
  }
}

assert.throws(
  () => assertNoWorkflowInvocation([
    ['Alternate GitHub Job.jsonc', '{"definition":{"do":[{"call":"invoke_backend_function","with":{"function_name":"syncGitHub"}}]}}']
  ]),
  /Alternate GitHub Job\.jsonc must not invoke syncGitHub/,
  'an alternate workflow filename must not bypass the scheduled-call gate'
);

const workflowDir = new URL('base44/workflows/', root);
const workflowEntries = readdirSync(workflowDir)
  .filter((name) => name.endsWith('.jsonc'))
  .map((name) => [name, read('base44/workflows/' + name)]);
assertNoWorkflowInvocation(workflowEntries);

assert.match(sync, /const REPO = 'interplanetarysister\/interplanetary-fund2'/);
assert.match(sync, /const BRANCH = 'main'/);
assert.match(sync, /if \(!user\) return Response\.json\(\{ error: 'Unauthorized' \}/);
assert.match(sync, /user\.role !== 'admin'/);
assert.doesNotMatch(sync, /initiator_type|isWorkflow/,
  'caller-supplied workflow labels must never bypass authentication');
assert.match(sync, /assertPlatformAccess\(sr, 'github'\)/);
assert.match(sync, /GitHub OAuth connector not authorized/);
assert.doesNotMatch(sync, /Deno\.Command|child_process|execSync|spawnSync/,
  'Base44 verification must use the provider API, not shell git');
assert.match(sync, /checked_at: now/,
  'the response timestamp must describe a connection check, not a completed sync');
assert.doesNotMatch(sync, /synced_at: now|GitHub sync could not complete/,
  'the advisory backend must not claim that source synchronization occurred');

const MISLEADING_SYNC_COPY =
  /\b(?:Sync GitHub|GitHub sync (?:complete|completed|skipped|issue|failed)|Sync (?:completed|failed|skipped|encountered)|sync function)\b/i;

function assertTruthfulCaller(source, path) {
  assert.match(
    source,
    /base44\.functions\.invoke\(\s*["']syncGitHub["']/,
    path + ' must remain an authenticated admin caller of syncGitHub'
  );
  assert.doesNotMatch(
    source,
    MISLEADING_SYNC_COPY,
    path + ' contains misleading synchronization wording for an advisory verification'
  );
  assert.match(
    source,
    /Verify GitHub|GitHub (?:status )?verifi|connection verification/i,
    path + ' must describe the operation as GitHub connection verification'
  );
}

assert.throws(
  () => assertTruthfulCaller(
    'base44.functions.invoke("syncGitHub", { direction: "both" }); <Button>Sync GitHub</Button>; toast({ title: "GitHub sync complete" });',
    'MisleadingCaller.jsx'
  ),
  /misleading synchronization wording/,
  'misleading caller copy must fail the contract'
);

function collectSourceFiles(directory, relative = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const childRelative = relative ? relative + '/' + entry.name : entry.name;
    if (entry.isDirectory()) {
      return collectSourceFiles(new URL(entry.name + '/', directory), childRelative);
    }
    return /\.(?:js|jsx|ts|tsx)$/.test(entry.name) ? [childRelative] : [];
  });
}

const liveCallers = collectSourceFiles(new URL('src/', root))
  .map((path) => ['src/' + path, read('src/' + path)])
  .filter(([, source]) => /base44\.functions\.invoke\(\s*["']syncGitHub["']/.test(source));

assert.ok(
  liveCallers.some(([path]) => path === 'src/pages/IntegrationsAdmin.jsx'),
  'IntegrationsAdmin must remain covered as a live caller'
);
assert.ok(
  liveCallers.some(([path]) => path === 'src/components/admin/IntegrationDetailPanel.jsx'),
  'IntegrationDetailPanel must remain covered as a live caller'
);
for (const [path, source] of liveCallers) assertTruthfulCaller(source, path);

assertTruthfulCaller(panel, 'src/components/admin/IntegrationDetailPanel.jsx');
assert.match(panel, /do not move files, create commits, or replace Base44/i,
  'the detail panel must describe the advisory check truthfully');
assertTruthfulCaller(adminPage, 'src/pages/IntegrationsAdmin.jsx');
assert.match(adminPage, /GitHub verification completed/);
assert.match(adminPage, /Could not verify the GitHub connection/);

assert.match(runbook, /scheduled GitHub workflow definition is intentionally absent/i);
assert.match(runbook, /caller-supplied[\s\S]*initiator_type/i);
assert.match(runbook, /authenticated\s+administrator/i);
assert.match(runbook, /server-verifiable workflow identity/i);

console.log('Base44 sync fail-closed and truthful-caller contract passed.');
