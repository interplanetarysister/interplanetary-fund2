import fs from 'node:fs';

const source = fs.readFileSync('base44/shared/rateLimit.ts', 'utf8');

const required = [
  'MAX_KEY_LENGTH',
  'MAX_WINDOW_SECONDS',
  'MAX_LIMIT',
  'diagnosticType',
  'safeKey',
  'safePositiveInteger',
  'normalizedKey',
  'normalizedMax',
  'normalizedWindow',
  "diagnostic_type: diagnosticType(error)",
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`Missing rate-limit safety contract: ${token}`);
  }
}

if (/console\.error\([^\n]*e\.message|console\.error\([^\n]*,\s*e\)/.test(source)) {
  throw new Error('Raw rate-limit exception disclosure remains');
}

if (!source.includes('updateMany({ id: bucket.id }, { $inc: { count: 1 } })')) {
  throw new Error('Expected atomic increment path is missing');
}

console.log('rate-limit-safe-diagnostics source contract passed');
