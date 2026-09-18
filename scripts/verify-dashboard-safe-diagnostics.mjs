import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Dashboard.jsx', 'utf8');
const required = [
  ['stable dashboard error', source.includes('SAFE_DASHBOARD_ERROR')],
  ['raw exception not rendered', !source.includes('e.message')],
  ['auth payload validation', source.includes('typeof me.id === "string"')],
  ['campaign payload validation', source.includes('Array.isArray(mine)')],
  ['request fencing', source.includes('requestRef.current === requestId')],
  ['mounted fencing', source.includes('mountedRef.current')],
  ['cleanup fence', source.includes('mountedRef.current = false')],
  ['retry remains wired', source.includes('setRefreshKey((k) => k + 1)')],
];
const failed = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error(`Dashboard safe-diagnostics verifier failed: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`Dashboard safe-diagnostics verifier passed (${required.length} checks).`);
