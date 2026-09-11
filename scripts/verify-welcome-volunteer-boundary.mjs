import fs from 'node:fs';

const source = fs.readFileSync('base44/functions/welcomeVolunteer/entry.ts', 'utf8');
const required = [
  ['POST method gate', source.includes("req.method !== 'POST'")],
  ['invalid JSON guard', source.includes("Invalid request body")],
  ['object and array guard', source.includes('Array.isArray(body)')],
  ['unexpected key rejection', source.includes("key !== 'signup_id'")],
  ['bounded signup id validation', source.includes('MAX_ID_LENGTH') && source.includes('isValidSignupId')],
  ['bounded diagnostics', source.includes('function diagnosticType')],
  ['not-found vs provider failure', source.includes('function isNotFoundError') && source.includes('getEntity')],
  ['bounded email/text fields', source.includes('function boundedText') && source.includes('function safeEmail')],
  ['newline-safe email validation', source.includes('\\r\\n') && source.includes('MAX_EMAIL_LENGTH')],
  ['no raw nested diagnostic', !source.includes('e.message')],
  ['no raw outer diagnostic', !source.includes('error.message')],
  ['safe outer response', source.includes('SAFE_WELCOME_ERROR')],
  ['notification preserved', source.includes('Notification.create')],
];

const failed = required.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('welcomeVolunteer verifier failed:', failed.map(([name]) => name).join(', '));
  process.exit(1);
}
console.log(`welcomeVolunteer verifier passed (${required.length} checks)`);
