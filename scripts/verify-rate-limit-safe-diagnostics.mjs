import fs from 'node:fs';

const source = fs.readFileSync('base44/shared/rateLimit.ts', 'utf8');
const checks = [
  ['diagnostic classifier exists', source.includes('function diagnosticType')],
  ['raw message access absent', !source.includes('error.message') && !source.includes('e.message')],
  ['raw object interpolation absent', !source.includes("${error}") && !source.includes("${e}")],
  ['safe diagnostic type is emitted', source.includes('diagnostic_type: diagnosticType(error)')],
  ['fail-open response preserved', source.includes('return { allowed: true, remaining: 0, retryAfterSeconds: 0 }')],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  for (const [name] of failed) console.error(`FAIL: ${name}`);
  process.exit(1);
}

console.log('PASS: rate limiter safe-diagnostics source contract');
