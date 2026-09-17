import fs from 'node:fs';

const source = fs.readFileSync('base44/shared/activityEvent.ts', 'utf8');
const failures = [];

const requireText = (text, label) => {
  if (!source.includes(text)) failures.push(label);
};

requireText('function sanitizeMetadata(metadata)', 'metadata sanitizer missing');
requireText('MAX_METADATA_KEYS = 12', 'metadata key cap missing');
requireText('SAFE_METADATA_KEY', 'metadata key allowlist missing');
requireText('if (error instanceof TypeError) return \'TypeError\';', 'stable TypeError classification missing');
requireText("return typeof error;", 'primitive fallback missing');
requireText("console.error('emitActivityEvent failed', { diagnosticType: diagnosticType(e) });", 'safe diagnostic logging missing');
requireText('metadata: sanitizeMetadata(event.metadata)', 'sanitized metadata not persisted');
if (source.includes('e.message') || source.includes('error.name')) failures.push('raw exception/name disclosure remains');
if (source.includes('metadata: event.metadata')) failures.push('raw metadata persistence remains');

if (failures.length) {
  console.error(`activity-event safety verification failed: ${failures.join('; ')}`);
  process.exit(1);
}

console.log('activity-event safety verification passed');
