import { readFile } from 'node:fs/promises';

const path = 'base44/functions/kofiWebhook/entry.ts';
const source = await readFile(path, 'utf8');

const required = [
  'function safeWebhookError()',
  'const messageId = payload.message_id;',
  'Number.isFinite(amount)',
  'event?.messageId === messageId',
  "return Response.json({ error: safeWebhookError() }, { status: 500 });",
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`Missing Ko-fi webhook safety invariant: ${token}`);
  }
}

for (const pattern of [
  /return\s+Response\.json\(\{\s*error:\s*error\.message/,
  /parseFloat\(payload\.amount\)\s*\|\|\s*0/,
]) {
  if (pattern.test(source)) {
    throw new Error(`Unsafe Ko-fi webhook pattern remains: ${pattern}`);
  }
}

console.log('Ko-fi webhook contract verified.');
