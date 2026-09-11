import fs from 'node:fs';

const path = 'base44/functions/listInstitutionApplications/entry.ts';
const source = fs.readFileSync(path, 'utf8');

const required = [
  "if (req.method !== 'POST')",
  "Allow: 'POST'",
  'body = await req.json()',
  'Array.isArray(body)',
  'Object.keys(body)',
  "body.institution_id === 'string'",
  'MAX_ID_LENGTH',
  'ID_PATTERN',
  'const institutionId =',
  'diagnosticType(error)',
  "console.error('listInstitutionApplications failed', { type: diagnosticType(error) })",
  "error: 'Unable to load applications. Please try again.'",
  'function validId(value)',
  'function validDate(value)',
  'function projectApplication(application)',
  'MAX_APPLICATIONS',
  'MAX_AMOUNT',
  'application.amount_requested < 0',
  'projectedApplications.some((application) => application === null)',
];

for (const fragment of required) {
  if (!source.includes(fragment)) throw new Error(`Missing required boundary fragment: ${fragment}`);
}

if (/error\.message|JSON\.stringify\(error\)/.test(source)) {
  throw new Error('Raw error diagnostics must not be logged or returned');
}
if (/filter\(\{ institution_id \}/.test(source)) {
  throw new Error('Lookup must use the normalized institution identifier');
}
if (/return \{ \.\.\.application \}/.test(source)) {
  throw new Error('Applications must cross the boundary through an explicit projection');
}
if (!/typeof application\.amount_requested === 'number'/.test(source)) {
  throw new Error('Numeric application fields must be type checked');
}
if (!/application\.amount_requested > MAX_AMOUNT/.test(source)) {
  throw new Error('Application amount must be bounded');
}
if (!/projectedApplications\.some\(\(application\) => application === null\)/.test(source)) {
  throw new Error('Malformed application rows must fail closed');
}

console.log('listInstitutionApplications boundary verifier passed');
