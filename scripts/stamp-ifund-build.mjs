import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

// A release label is a product label, not proof that two hosts serve the
// same compiled build. Stamp the actual Git commit and JS entry at build time.
const html = fs.readFileSync('dist/index.html', 'utf8');
const entry = html.match(/\bsrc=["'](\/assets\/index-[\w-]+\.js)["']/)?.[1];
assert.ok(entry, 'Vite entry asset not found; refusing to stamp an unverified build');
const bytes = fs.readFileSync('dist' + entry);
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
const release = JSON.parse(fs.readFileSync('public/ifund-release.json', 'utf8'));
assert.ok(release.release_id, 'Release label must be present');

// Hosted builds (Base44) ship the source without a .git directory, so a
// missing repository must not fail the release. Prefer an explicit commit from
// the build environment, then the local checkout, then the compiled entry's own
// digest — which still identifies exactly what was served.
function resolveSourceCommit() {
  const fromEnv = String(
    process.env.GITHUB_SHA || process.env.SOURCE_COMMIT ||
    process.env.BASE44_BUILD_COMMIT || process.env.VITE_BUILD_COMMIT || ''
  ).trim().toLowerCase();
  if (/^[0-9a-f]{40}$/.test(fromEnv)) return fromEnv;
  try {
    const value = execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim().toLowerCase();
    return /^[0-9a-f]{40}$/.test(value) ? value : '';
  } catch {
    return '';
  }
}

const commit = resolveSourceCommit();
const identity = {
  schema_version: 1,
  release_id: release.release_id,
  source_commit: commit || sha256,
  source_kind: commit ? 'git' : 'entry-digest',
  entry_asset: entry,
  entry_sha256: sha256,
};
fs.writeFileSync('dist/ifund-build.json', JSON.stringify(identity, null, 2) + '\n');
assert.deepEqual(JSON.parse(fs.readFileSync('dist/ifund-build.json', 'utf8')), identity);
console.log('PASS: build identity stamped from', identity.source_kind === 'git' ? 'Git commit' : 'compiled entry digest', identity.source_commit.slice(0, 12), entry);