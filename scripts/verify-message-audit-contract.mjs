import { readFileSync } from 'node:fs';

const messageSchema = readFileSync('base44/entities/Message.jsonc', 'utf8');
const sender = readFileSync('base44/functions/sendCommunication/entry.ts', 'utf8');

const requiredSchemaFragments = [
  '"create": false',
  '"read": {',
  '"created_by_id": "{{user.id}}"',
];
for (const fragment of requiredSchemaFragments) {
  if (!messageSchema.includes(fragment)) {
    throw new Error(`Missing Message security contract: ${fragment}`);
  }
}

const requiredSenderFragments = [
  'base44.asServiceRole.entities.Message.create',
  'created_by_id: user.id',
  'ALLOWED_CHANNELS',
  'ALLOWED_COMM_TYPES',
  'ALLOWED_AUDIENCES',
  'MAX_SUBJECT_LENGTH',
  'MAX_CONTENT_LENGTH',
  "return Response.json({ error: 'Unable to send communication.' }, { status: 500 });",
];
for (const fragment of requiredSenderFragments) {
  if (!sender.includes(fragment)) {
    throw new Error(`Missing sendCommunication security contract: ${fragment}`);
  }
}

if (/Message\.create\s*\(/.test(sender) && !/asServiceRole\.entities\.Message\.create/.test(sender)) {
  throw new Error('Message creation must remain on the service-role path');
}
if (/Response\.json\(\{\s*error:\s*error\.message/.test(sender)) {
  throw new Error('sendCommunication must not expose raw backend error text');
}

console.log('Message audit contract verification passed.');
