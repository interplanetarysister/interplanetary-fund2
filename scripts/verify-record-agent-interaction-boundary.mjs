import fs from 'node:fs';

const source = fs.readFileSync('base44/functions/recordAgentInteraction/entry.ts', 'utf8');
const required = [
  ['POST-only method gate', source.includes("req.method !== 'POST'")],
  ['allowlisted keys', source.includes('ALLOWED_KEYS')],
  ['plain object validation', source.includes('isPlainObject(body)')],
  ['bounded canonical agent id', source.includes('boundedText(body.canonicalAgentId, 128)')],
  ['bounded summary', source.includes('boundedText(body.summary, 2000)')],
  ['boolean approval validation', source.includes("typeof body.approved !== 'boolean'")],
  ['safe diagnostic classifier', source.includes('safeDiagnostic')],
  ['no raw error.message access', !source.includes('error.message') && !source.includes('e.message')],
  ['malformed Convex response rejection', source.includes("json.status !== 'success'")],
  ['explicit success value requirement', source.includes("hasOwnProperty.call(json, 'value')")],
];
const failures = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failures.length) {
  console.error(`recordAgentInteraction boundary verifier failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('recordAgentInteraction boundary verifier passed');
