import fs from 'node:fs';

const source = fs.readFileSync('base44/shared/activityEvent.ts', 'utf8');
const checks = [
  ['failure classifier exists', source.includes('classifyActivityEventFailure')],
  ['no direct message access', !source.includes('error.message') && !source.includes('e.message')],
  ['no thrown object interpolation', !source.includes('${error}') && !source.includes('${e}')],
  ['stable failure_type field', source.includes('failure_type: classifyActivityEventFailure(error)')],
  ['best-effort contract preserved', source.includes('export async function emitActivityEvent')],
];

for (const [label, passed] of checks) {
  if (!passed) throw new Error(`activity-event verifier failed: ${label}`);
}

console.log('activity-event safe diagnostics verifier passed');
