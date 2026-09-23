import fs from 'node:fs';

const source = fs.readFileSync('base44/functions/welcomeVolunteer/entry.ts', 'utf8');

const required = [
  "req.method !== 'POST'",
  "headers: { Allow: 'POST' }",
  'isValidSignupId',
  'MAX_SIGNUP_ID_LENGTH',
  'Array.isArray(body)',
  "Response.json({ error: 'Invalid request' }, { status: 400 })",
  'isNotFoundError',
  "status: 503",
  "'Retry-After': '30'",
  'safeLog',
  'SAFE_ERROR',
];

const forbidden = [
  'error.message',
  'console.error(\'welcomeVolunteer error:',
  'const { signup_id } = await req.json()',
  'if (!signup_id)',
  '.catch(() => null)',
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`missing required safety token: ${token}`);
  }
}

for (const token of forbidden) {
  if (source.includes(token)) {
    throw new Error(`forbidden unsafe pattern present: ${token}`);
  }
}

console.log('welcome volunteer safety contract passed');
