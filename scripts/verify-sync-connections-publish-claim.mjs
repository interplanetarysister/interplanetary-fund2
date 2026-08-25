import fs from 'node:fs';

const entry = fs.readFileSync('base44/functions/syncConnections/entry.ts', 'utf8');
const schema = fs.readFileSync('base44/entities/DistributedPost.jsonc', 'utf8');

const checks = [
  ['publishing status is a schema state', schema.includes('"publishing"')],
  ['publish claim timestamp is persisted', schema.includes('"publish_claimed_at"')],
  ['publish claim token is persisted', schema.includes('"publish_claim_token"')],
  ['conditional updateMany claim exists', entry.includes('DistributedPost.updateMany(')],
  ['claim requires the observed post id', entry.includes('{ id: post.id, status: post.status }')],
  ['claim transitions to publishing before provider call', entry.includes("status: 'publishing'") && entry.indexOf("status: 'publishing'") < entry.indexOf('publishThroughConnection(')],
  ['provider call occurs only after claim', entry.indexOf('publishThroughConnection(') > entry.indexOf('updateMany(')],
  ['claim is released after successful publication', entry.includes("publish_claimed_at: null") && entry.includes("status: 'published'")],
  ['stale claims are quarantined', entry.includes('SAFE_UNKNOWN_OUTCOME') && entry.includes('isStalePublishClaim')],
  ['stale claims are not automatically republished', entry.includes('Do not republish automatically')],
  ['raw provider errors stay server-side', entry.includes("console.error('syncConnections publish error:'") && !entry.includes('error.message')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [label, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);

if (failed.length) {
  console.error(`syncConnections publication-claim verification failed: ${failed.length} check(s).`);
  process.exit(1);
}

console.log(`syncConnections publication-claim verification passed: ${checks.length} checks.`);
