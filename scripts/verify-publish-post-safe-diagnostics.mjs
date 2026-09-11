import fs from 'node:fs';

const source = fs.readFileSync('base44/functions/publishPost/entry.ts', 'utf8');

const required = [
  'function classifyPublishError(error)',
  "diagnostic_type: classifyPublishError(pubError)",
  "diagnostic_type: classifyPublishError(error)",
  "error: 'Publishing failed.'",
  "error: 'Unable to publish this post. Please try again.'",
];

for (const token of required) {
  if (!source.includes(token)) throw new Error(`Missing safe publishPost contract: ${token}`);
}

if (/console\.error\([^\n]*error\.message/.test(source)) {
  throw new Error('publishPost must not log raw error.message');
}
if (/console\.error\([^\n]*pubError\.message/.test(source)) {
  throw new Error('publishPost must not log raw pubError.message');
}

console.log('publishPost safe-diagnostics contract verified');
