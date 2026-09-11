import fs from 'node:fs';

const source = fs.readFileSync('base44/functions/volunteerSignup/entry.ts', 'utf8');

const required = [
  ['method guard', "Method not allowed."],
  ['body parse guard', "Invalid request body."],
  ['strict body keys', "keys.length !== 1 || keys[0] !== 'opportunity_id'"],
  ['canonical identifier', "const opportunityId = typeof body.opportunity_id === 'string' ? body.opportunity_id.trim() : ''"],
  ['control-character rejection', "[\\u0000-\\u001f\\u007f]"],
  ['stable failure response', "Unable to sign you up. Please try again."],
  ['diagnostic minimization', "console.error('volunteerSignup failed:', type)"],
  ['atomic increment', "$inc: { volunteer_count: 1 }"],
  ['normalized lookup', 'get(opportunityId)'],
  ['normalized dedupe', 'opportunity_id: opportunityId'],
];

for (const [name, token] of required) {
  if (!source.includes(token)) throw new Error(`Missing ${name}: ${token}`);
}

if (/console\.error\([^\n]*error\.message/.test(source)) {
  throw new Error('Raw error.message logging remains');
}
if (/console\.error\([^\n]*(error|err)\s*\)?/.test(source)) {
  throw new Error('Raw error object logging remains');
}
if (/const \{\s*opportunity_id\s*\} = body/.test(source)) {
  throw new Error('Unnormalized opportunity_id remains in request boundary');
}

console.log('volunteerSignup boundary verifier passed');
