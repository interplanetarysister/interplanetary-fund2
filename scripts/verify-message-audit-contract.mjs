import fs from 'node:fs';

const schema = fs.readFileSync('base44/entities/Message.jsonc', 'utf8');
const entry = fs.readFileSync('base44/functions/sendCommunication/entry.ts', 'utf8');

const failures = [];
const requireText = (source, pattern, message) => {
  if (!pattern.test(source)) failures.push(message);
};

// Security boundary.
requireText(schema, /"create"\s*:\s*false/, 'Message creation must be server-only');
requireText(schema, /"created_by_id": "\{\{user\.id\}\}"/, 'Message read RLS must remain owner-scoped');
requireText(schema, /"role": "admin"/, 'Message admin audit access must remain available');
requireText(entry, /asServiceRole\.entities\.Message\.create/, 'legitimate audit creation must use service-role access');
requireText(entry, /created_by_id: user\.id/, 'service-created Message must retain authenticated sender ownership');

// Preserve the complete existing Message schema while changing only the creation boundary.
for (const property of [
  'campaign_id',
  'campaign_title',
  'subject',
  'content',
  'comm_type',
  'audience',
  'channels',
  'status',
  'sent_at',
  'recipient_count',
  'email_count',
  'in_app_count',
  'ai_generated',
]) {
  requireText(schema, new RegExp(`"${property}"\\s*:`), `Message schema must preserve ${property}`);
}
for (const value of [
  'update',
  'thank_you',
  'announcement',
  'milestone',
  'volunteer',
  'sponsor',
  'campaign_donors',
  'all_donors',
  'recurring_donors',
  'email',
  'in_app',
  'draft',
  'sent',
]) {
  requireText(schema, new RegExp(`"${value}"`), `Message schema must preserve enum value ${value}`);
}

// Request validation and safe error boundary.
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
