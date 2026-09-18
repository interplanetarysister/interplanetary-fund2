import fs from 'node:fs';

const source = fs.readFileSync('src/components/community/ActivityFeed.jsx', 'utf8');
const checks = [
  ['stable safe error constant', source.includes('SAFE_FEED_ERROR')],
  ['no direct thrown-message access', !source.includes('e.message') && !source.includes('err.message') && !source.includes('error.message')],
  ['no raw thrown interpolation', !source.includes('setError(e)') && !source.includes('setError(error)')],
  ['feed payload array validation', source.includes('Array.isArray(data.items)')],
  ['request generation fencing', source.includes('requestIdRef') && source.includes('requestId !== requestIdRef.current')],
  ['unmount fencing', source.includes('mountedRef')],
  ['pagination finally reset', source.includes('finally') && source.includes('setLoadingMore(false)')],
];
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('ActivityFeed safety verifier failed:', failed.map(([name]) => name).join(', '));
  process.exit(1);
}
console.log(`ActivityFeed safety verifier passed (${checks.length} checks).`);
