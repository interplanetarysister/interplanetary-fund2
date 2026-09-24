import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const workflow = read('base44/workflows/GitHub Sync.jsonc');
const sync = read('base44/functions/syncGitHub/entry.ts');
const pkg = JSON.parse(read('package.json'));
const nodeVersion = read('.node-version').trim();
const nvmrc = read('.nvmrc').trim();
const quality = read('.github/workflows/quality-gates.yml');

assert.equal(nodeVersion, '22', '.node-version must stay on Node 22');
assert.equal(nvmrc, '22', '.nvmrc must stay on Node 22');
assert.equal(pkg.engines?.node, '>=22 <23', 'package engine must stay on Node 22');
assert.doesNotMatch(quality, /node-version:\s*20(?:\.x)?\b/, 'production gates must not reintroduce Node 20');
assert.match(quality, /node-version:\s*22\b/, 'production gates must execute on Node 22');

assert.match(workflow, /"name":\s*"GitHub Sync"/);
assert.match(workflow, /"trigger_type":\s*"scheduled"/);
assert.match(workflow, /"cron_expression":\s*"\*\/15 \* \* \* \*"/);
assert.match(workflow, /"function_name":\s*"syncGitHub"/);
assert.match(workflow, /"direction":\s*"both"/);
assert.match(sync, /const REPO = 'interplanetarysister\/interplanetary-fund2'/);
assert.match(sync, /const BRANCH = 'main'/);
assert.match(sync, /assertPlatformAccess\(sr, 'github'\)/);
assert.match(sync, /GitHub OAuth connector not authorized/);
assert.match(sync, /if \(!isWorkflow && !user\)/, 'scheduled workflow identity must not require an interactive user session');
assert.doesNotMatch(sync, /Deno\.Command|child_process|execSync|spawnSync/, 'Base44 sync must use the provider API, not shell git');

console.log('Base44 sync contract passed.');
