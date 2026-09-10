import fs from 'node:fs';

const path = 'base44/functions/welcomeVolunteer/entry.ts';
const source = fs.readFileSync(path, 'utf8');

const required = [
  ['safe diagnostic shape', "console.error(label, { error_name: errorName })"],
  ['missing signup validation', "if (!signup_id) return Response.json({ error: 'Missing signup_id' }, { status: 400 });"],
  ['missing record handling', "if (!signup) return Response.json({ error: 'Signup not found' }, { status: 404 });"],
  ['provider failure is non-fatal', "logFailure('welcome email failed', error);"],
  ['safe top-level response', "return Response.json({ error: 'Unable to send the welcome. Please try again.' }, { status: 500 });"],
  ['service-role boundary', 'const sr = base44.asServiceRole;'],
];

for (const [label, fragment] of required) {
  if (!source.includes(fragment)) throw new Error(`Missing ${label}`);
}

if (/error\.message|JSON\.stringify\(error|console\.error\([^\n]*error\)/.test(source)) {
  throw new Error('Raw error serialization or message disclosure remains');
}

if (/req\.method/.test(source) === false) {
  console.warn('NOTICE: request-method validation is not represented in the current function source; hosted/runtime proof remains required.');
}

if (/idempot|dedup|replay|notification_id|request_id/i.test(source) === false) {
  console.warn('NOTICE: durable duplicate-side-effect protection is not represented in the current function source; hosted/runtime proof remains required.');
}

console.log('welcomeVolunteer safety contract checks passed for static source invariants.');
