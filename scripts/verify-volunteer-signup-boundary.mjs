import fs from 'node:fs';

const source = fs.readFileSync('base44/functions/volunteerSignup/entry.ts', 'utf8');

const required = [
  ["method guard", "Method not allowed."],
  ["body parse guard", "Invalid request body."],
  ["identifier validation", "typeof opportunity_id !== 'string'"],
  ["stable failure response", "Unable to sign you up. Please try again."],
  ["diagnostic minimization", "console.error('volunteerSignup failed:', type)"],
  ["atomic increment", "$inc: { volunteer_count: 1 }"],
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

console.log('volunteerSignup boundary verifier passed');
