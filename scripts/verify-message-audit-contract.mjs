import fs from 'node:fs';

const schema = fs.readFileSync('base44/entities/Message.jsonc', 'utf8');
const entry = fs.readFileSync('base44/functions/sendCommunication/entry.ts', 'utf8');

const failures = [];
const requireText = (source, pattern, message) => {
  if (!pattern.test(source)) failures.push(message);
};

requireText(schema, /"create"\s*:\s*false/, 'Message creation must be server-only');
requireText(schema, /"created_by_id": "\{\{user\.id\}\}"/, 'Message read RLS must remain owner-scoped');
requireText(entry, /asServiceRole\.entities\.Message\.create/, 'legitimate audit creation must use service-role access');
requireText(entry, /created_by_id: user\.id/, 'service-created Message must retain authenticated sender ownership');
requireText(entry, /ALLOWED_CHANNELS/, 'communication channels must be allowlisted');
requireText(entry, /MAX_SUBJECT_LENGTH/, 'subject length must be bounded');
requireText(entry, /MAX_CONTENT_LENGTH/, 'content length must be bounded');
requireText(entry, /ALLOWED_COMM_TYPES/, 'communication type must be allowlisted');
requireText(entry, /ALLOWED_AUDIENCES/, 'audience must be allowlisted');
requireText(entry, /Unable to send communication\./, 'unexpected backend errors must use a stable client-safe message');
if (/Response\.json\(\{ error: error\.message/.test(entry) || /Response\.json\(\{ error: error\?\.message/.test(entry)) failures.push('raw backend exception text must not cross the API boundary');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Message audit security contract verified.');
