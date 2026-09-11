import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Analytics.jsx', 'utf8');
const required = [
  ['stable safe error', source.includes('SAFE_ANALYTICS_ERROR')],
  ['raw exception not rendered', !source.includes('e.message')],
  ['malformed entity rejection', source.includes('isEntityList')],
  ['bounded entity list', source.includes('MAX_LIST_SIZE')],
  ['safe entity keys', source.includes('SENSITIVE_KEY_PATTERN') && source.includes('hasSafeKeys')],
  ['malformed donation rejection', source.includes('isDonationList')],
  ['non-negative donation contract', source.includes('item.amount >= 0')],
  ['donation deduplication', source.includes('new Map(donations.map')],
  ['bounded request fan-out', source.includes('mapWithConcurrency') && source.includes('MAX_PARALLEL_REQUESTS')],
  ['request fencing', source.includes('requestId') && source.includes('mounted')],
  ['refresh retry', source.includes('setRefreshKey((k) => k + 1)')],
];

for (const [name, ok] of required) {
  if (!ok) throw new Error(`Analytics safety contract failed: ${name}`);
}

console.log('Analytics safety contract passed.');
