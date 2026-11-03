import assert from 'node:assert/strict';
import fs from 'node:fs';
import { collectCursorPages, isDonationList, mapWithConcurrency } from '../src/lib/analyticsData.js';

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
  ['signup scope is current account', dataSource.includes('VolunteerSignup, { user_id: userId }') && !dataSource.includes('VolunteerSignup, { opportunity_id:')],
  ['owner-only complete donations', donationSource.includes('analytics_complete && !isOwner && !isAdmin')],
  ['backend cursor cannot stall', donationSource.includes("Donation cursor made no progress") && donationSource.includes("Donation cursor repeated")],
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
  collectCursorPages(async () => ({ items: [], has_more: true, next_cursor: 'same' })),
  /no progress/,
);
let repeatedCursorCall = 0;
await assert.rejects(
  collectCursorPages(async () => {
    repeatedCursorCall += 1;
    return { items: [{ id: `item-${repeatedCursorCall}` }], has_more: true, next_cursor: 'same' };
  }),
  /repeated/,
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

assert.equal(isDonationList([{ id: 'good', amount: 10, created_date: '2026-10-24T12:00:00Z' }]), true);
for (const amount of [null, '', true, '10', Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
  assert.equal(isDonationList([{ id: 'bad', amount, created_date: '2026-10-24T12:00:00Z' }]), false);
}
assert.equal(isDonationList([{ id: 'bad-date', amount: 10, created_date: 'not-a-date' }]), false);
for (const created_date of ['Oct 5', '2026-02-30T12:00:00Z', '2026-10-24T24:00:00Z', '2026-10-24T12:00:00']) {
  assert.equal(isDonationList([{ id: 'invalid-date', amount: 10, created_date }]), false);
}
assert.equal(isDonationList([{ id: 'offset-date', amount: 10, created_date: '2026-10-24T12:00:00.123-07:00' }]), true);

const entity = (items) => ({
  list: async () => ({ items, has_more: false, next_cursor: null }),
  filter: async () => ({ items, has_more: false, next_cursor: null }),
});
const mockBase44 = {
  entities: {
    Campaign: entity([{ id: 'campaign-1' }]),
    Community: entity([{ id: 'community-1' }]),
    Institution: entity([{ id: 'institution-1' }]),
    VolunteerOpportunity: entity([{ id: 'opportunity-1' }]),
    GrantApplication: entity([{ id: 'application-1' }]),
    InstitutionOpportunity: entity([{ id: 'grant-1' }]),
    VolunteerSignup: {
      filter: async (query) => {
        assert.deepEqual(query, { user_id: 'user-1' });
        return { items: [{ id: 'signup-1' }], has_more: false, next_cursor: null };
      },
    },
  },
  functions: {
    invoke: async (name, body) => {
      assert.equal(name, 'getCampaignDonations');
      assert.deepEqual(body, { campaign_id: 'campaign-1', analytics_complete: true });
      return { data: { complete: true, donations: [{ id: 'donation-1', amount: 25, created_date: '2026-10-24T12:00:00Z' }] } };
    },
  },
};
const { loadAnalyticsData } = await import('../src/lib/analyticsData.js');
const loaded = await loadAnalyticsData(mockBase44, 'user-1');
assert.equal(loaded.donations.length, 1);
assert.equal(loaded.signups.length, 1);

const incompleteBase44 = {
  ...mockBase44,
  functions: { invoke: async () => ({ data: { complete: false, donations: [] } }) },
};
await assert.rejects(loadAnalyticsData(incompleteBase44, 'user-1'), /Incomplete analytics donation response/);

console.log('Analytics safety contract passed.');
