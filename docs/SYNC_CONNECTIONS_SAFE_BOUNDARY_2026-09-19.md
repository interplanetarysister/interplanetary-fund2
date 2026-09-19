# syncConnections safe-boundary correction — 2026-09-19

## Source
- Base: `main` at `034bd94b815cb803b5cc975418cc05b54e173250`
- File: `base44/functions/syncConnections/entry.ts`
- Queue owner: Issue #384

## Findings corrected
- Raw provider exception text was persisted in `DistributedPost.error`.
- Raw provider exception text was interpolated into owner notifications.
- Raw outer exception text was logged.
- Queue and connection row shapes were trusted before property access.
- Publish response shape was not checked before persisting its URL.
- Retry counts were not explicitly capped at the configured maximum.

## Implemented boundary
- Added a no-raw thrown-value classifier with low-cardinality diagnostics.
- Replaced persisted/notification error text with stable bounded categories and safe copy.
- Added record, queue-row, connection-row, and publish-response validation.
- Explicitly caps retry count at `MAX_RETRIES`.
- Preserves the existing service-role worker flow, OBO/platform access gates, notification semantics, and stale-connection health update.

## Deliberate non-claims
- This slice does **not** establish a durable single-winner claim, lease/fencing, or cross-run idempotency contract for scheduled publishing.
- Duplicate scheduler invocations, response-loss after external publish, and concurrent status updates remain blocked on the authoritative backend/deployment mapping and Development-first validation under #218/#310.
- No provider verification, financial workflow, RLS, deployment, merge, or Production behavior change is claimed.

## Handoff requirements
- Rebaseline against the exact current `main` before approval.
- Run Node 22 locked `npm ci`, lint, typecheck, production build, focused verifier, and the complete no-skip verifier chain.
- Add runtime-faithful hostile thrown-value, malformed row/response, response-loss/retry, duplicate-run, and notification-sink checks.
- Review service-role/provider semantics and downstream consumers of `DistributedPost.error`.
- Keep Draft/open/unmerged until Agent 2+3 review, Agent 1 correction, and Agent 3 publication audit.
