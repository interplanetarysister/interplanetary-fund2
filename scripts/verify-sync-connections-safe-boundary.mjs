import fs from 'node:fs';

const source = fs.readFileSync('base44/functions/syncConnections/entry.ts', 'utf8');
const checks = [
  ['bounded classifier', source.includes('function classifyThrownValue') && source.includes('function safeDiagnostic')],
  ['no raw caught message access', !source.includes('e.message') && !source.includes('error.message')],
  ['no raw persisted provider text', !source.includes('error: e.message')],
  ['no raw notification interpolation', !source.includes('failed after ${MAX_RETRIES} attempts: ${e.message}')],
  ['queue row validation', source.includes('isPublishablePost') && source.includes('.filter(isPublishablePost)')],
  ['connection validation', source.includes('isConnection')],
  ['publish response validation', source.includes('MALFORMED_PUBLISH_RESPONSE')],
  ['bounded retry count', source.includes('Math.min(') && source.includes('MAX_RETRIES')],
  ['safe outer logging', source.includes('safeDiagnostic(error, SAFE_SYNC_ERROR)')],
  ['no durable claim overclaim', source.includes('DistributedPost.update')],
];

for (const [label, pass] of checks) {
  if (!pass) throw new Error(`syncConnections verifier failed: ${label}`);
}

console.log(`syncConnections safe-boundary verifier passed (${checks.length} checks).`);
