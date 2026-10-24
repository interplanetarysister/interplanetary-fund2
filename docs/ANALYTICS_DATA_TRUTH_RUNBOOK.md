# Analytics data-truth runbook

## Current authority

The Base44 application is authoritative for the Analytics page and its data access. `src/lib/analyticsData.js` owns client-side collection and validation; `base44/functions/getCampaignDonations/entry.ts` owns the privileged donation boundary. Historical Convex or Vercel analytics code is reference material only.

## Required behavior

- Analytics totals and generated-report inputs must be complete, provider-verified data or fail closed. Never substitute an empty list, zero, a partial page, or a coerced value for a failed/malformed response.
- All entity walks use Base44 cursor pagination, reject malformed, empty-progress, or repeated cursors, and stop at the explicit safety ceiling instead of returning partial data.
- Complete donation retrieval is available only to the campaign owner or an administrator. Totals include only records with `payment_verified === true` and valid positive numeric amounts and dates.
- Donation requests may run concurrently only within the established bound. Volunteer signup analytics is explicitly scoped to `user_id`; administrator status must not silently change that metric into a platform-wide total.
- Refresh retains the last complete view. A failed refresh shows a safe inline error and never clears or replaces known-good data with zeros.
- Browser-visible errors never include raw backend/provider details. Loading and error states remain announced to assistive technology.

## Verification

Run `npm run verify:analytics-safety`, lint, typecheck, and the production build on the exact PR head. The analytics verifier must cover successful multi-page collection, malformed and non-progressing cursors, record ceilings, concurrency, amount/date validation, current-user signup scope, complete donation requests, and rejection of incomplete responses.

Repository checks prove source behavior only. Do not call the repair deployed or production-verified until the authoritative Base44 host has exercised cursor paging, owner/administrator access, forbidden access, high-volume pagination, refresh failure, and mobile/accessibility states without consuming prohibited credits.

## Future provider or host restoration

If Convex, Vercel, or another host is restored, preserve these interfaces and semantics:

1. `configuration` is not provider verification;
2. a paginated observation is not a complete total until the final-page proof is present;
3. owner/admin authorization is enforced server-side before privileged donation rows are returned;
4. only provider-confirmed gifts enter analytics, and external observations remain non-withdrawable until a separate verified transfer credits the canonical ledger;
5. currencies remain separate unless an explicit, sourced conversion contract exists;
6. the alternate adapter must return an explicit completeness signal and must fail closed on malformed or partial data;
7. cutover requires parity tests and a reversible switch; Base44 remains authoritative until that cutover is separately authorized.

## Progressive improvement path

1. Keep the current cursor-paginated Base44 correction and bounded fan-out.
2. Replace row loading with a single Base44 backend aggregation function using `count`/`aggregate` where the UI does not need individual records.
3. Add server-side time-bucketed revenue aggregation and hosted high-volume authorization fixtures.
4. Add a provider-neutral analytics adapter only when an alternate host is actually restored and parity/rollback evidence exists.

Rollback before activation is removal or reversion of the focused PR. No schema, credential, provider connection, payment state, or production route is changed by the source-only repair.
