import fs from 'node:fs';

const source = fs.readFileSync('src/pages/MyGiving.jsx', 'utf8');
const required = [
  ['stable safe error constant', source.includes('SAFE_MY_GIVING_ERROR')],
  ['raw exception message is not rendered', !source.includes('e.message')],
  ['catch does not expose thrown value', source.includes('} catch {')],
  ['stable error is used', source.includes('setError(SAFE_MY_GIVING_ERROR)')],
  ['retry remains available', source.includes('onRetry=')],
];

const failed = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error(`MyGiving diagnostics verification failed: ${failed.join(', ')}`);
  process.exit(1);
}
console.log('MyGiving diagnostics verification passed.');
