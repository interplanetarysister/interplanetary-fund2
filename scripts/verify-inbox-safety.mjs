import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Inbox.jsx', 'utf8');
const required = [
  ['stable safe error', source.includes('SAFE_INBOX_ERROR')],
  ['no raw exception message rendering', !source.includes('e.message') && !source.includes('error.message')],
  ['mounted fencing', source.includes('mountedRef') && source.includes('canCommit')],
  ['request sequencing', source.includes('requestRef') && source.includes('requestId === requestRef.current')],
  ['malformed auth fail closed', source.includes('invalid-auth')],
  ['malformed collections fail closed', source.includes('invalid-collection')],
  ['malformed donations fail closed', source.includes('invalid-donations')],
  ['finite donation validation', source.includes('Number.isFinite(value)')],
  ['bounded text projection', source.includes('MAX_TEXT') && source.includes('boundedText')],
  ['truthful retry', source.includes('const retry = () =>') && source.includes('setRefreshKey')],
];
const failed = required.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(`Inbox safety verification failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log('Inbox safety verification passed.');
