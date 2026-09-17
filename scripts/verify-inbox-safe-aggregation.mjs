import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Inbox.jsx', 'utf8');
const required = [
  ['stable safe error', source.includes('SAFE_INBOX_ERROR')],
  ['no raw exception rendering', !source.includes('e.message')],
  ['explicit array validator', source.includes('function isArray') && source.includes('Array.isArray')],
  ['malformed base response rejection', source.includes('every(isArray)')],
  ['malformed donation response rejection', source.includes('result.data?.donations') && source.includes('invalid donation response')],
  ['request generation fencing', source.includes('requestRef') && source.includes('requestId')],
  ['mounted fencing', source.includes('mountedRef') && source.includes('mountedRef.current')],
  ['refresh remains wired', source.includes('setRefreshKey((k) => k + 1)')],
  ['safe error catch', source.includes('catch {') && source.includes('setError(SAFE_INBOX_ERROR)')],
];

const failures = required.filter(([, ok]) => !ok);
if (failures.length) {
  console.error('Inbox safe aggregation verifier failed:');
  for (const [name] of failures) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`Inbox safe aggregation verifier passed (${required.length} checks).`);
