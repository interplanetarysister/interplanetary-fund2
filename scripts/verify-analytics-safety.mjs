import assert from 'node:assert/strict';
import fs from 'node:fs';
import { collectCursorPages, mapWithConcurrency } from '../src/lib/analyticsData.js';

const pageSource = fs.readFileSync('src/pages/Analytics.jsx', 'utf8');
const dataSource = fs.readFileSync('src/lib/analyticsData.js', 'utf8');
const donationSource = fs.readFileSync('base44/functions/getCampaignDonations/entry.ts', 'utf8');
const required = [
  ['stable safe error', pageSource.includes('SAFE_ANALYTICS_ERROR')],
  ['raw exception not rendered', !pageSource.includes('.message')],
  ['auth response fails closed', pageSource.includes('Malformed auth response')],
  ['request generation fencing', pageSource.includes('requestGeneration') && pageSource.includes('mounted')],
  ['refresh preserves existing data', !pageSource.includes('setData(null)') && pageSource.includes('SAFE_ANALYTICS_REFRESH_ERROR') && pageSource.includes('last complete view is preserved')],
  ['loading live region', pageSource.includes('role="status"') && pageSource.includes('aria-live="polite"')],
  ['cursor pagination', dataSource.includes('next_cursor') && dataSource.includes('has_more')],
  ['bounded fan-out', dataSource.includes('mapWithConcurrency')],
  ['complete donation proof required', dataSource.includes('response.data.complete !== true')],
  ['owner-only complete donations', donationSource.includes('analytics_complete && !isOwner && !isAdmin')],
  ['verified donations only', donationSource.includes('d.payment_verified === true')],
];
for (const [name, ok] of required) {
  if (!ok) throw new Error(`Analytics safety contract failed: ${name}`);
}

const pages = [
  { items: [{ id: 'a' }, { id: 'b' }], has_more: true, next_cursor: 'page-2' },
  { items: [{ id: 'c' }], has_more: false, next_cursor: null },
];
const seenCursors = [];
const collected = await collectCursorPages(async (cursor) => {
  seenCursors.push(cursor);
  return pages.shift();
}, { pageSize: 2, maxRecords: 3 });
assert.deepEqual(collected.map((item) => item.id), ['a', 'b', 'c']);
assert.deepEqual(seenCursors, [null, 'page-2']);

await assert.rejects(
  collectCursorPages(async () => ({ items: [{ id: 'a' }], has_more: true, next_cursor: null })),
  /cursor/,
);
await assert.rejects(
  collectCursorPages(async () => ({ items: [{ id: 'a' }, { id: 'b' }], has_more: false, next_cursor: null }), { maxRecords: 1 }),
  /safe limit/,
);

let active = 0;
let peak = 0;
const ordered = await mapWithConcurrency([0, 1, 2, 3, 4], async (value) => {
  active += 1;
  peak = Math.max(peak, active);
  await Promise.resolve();
  active -= 1;
  return value * 2;
}, 2);
assert.deepEqual(ordered, [0, 2, 4, 6, 8]);
assert.ok(peak <= 2);

console.log('Analytics safety contract passed.');
