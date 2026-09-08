# Base44 Fraud Workflow Runtime Inventory

Status: source inventory only. This document does not claim Development or Production validation.

## Current authoritative entry point

`base44/functions/requestWithdrawal/entry.ts` is the current Base44 server entry point for withdrawal request and admin actions. It currently handles:

- `request` — fundraiser withdrawal request path;
- `approve` — admin-only approval path that submits PayPal payout;
- `reconcile_paid` — admin-only completion of a provider-accepted payout without resubmission;
- `release_reservation` — admin-only release after explicit confirmation that PayPal did not pay;
- `clear` — admin-only verification/clearing of pending donations.

All actions first create the Base44 client, use the service-role entity client, and call `assertActiveAccount(base44)`.

## Existing financial collaborators

- `base44/shared/convexFinancial.ts`
  - `ensureCanonicalCampaign`
  - `reserveCanonicalWithdrawal`
  - `completeCanonicalWithdrawal`
  - `cancelCanonicalWithdrawal`
  - `mirrorCanonicalCampaignTotal`
- `base44/shared/paypal.ts`
  - provider payout dispatch used by the approval path
- `base44/shared/fees.js`
  - `giftOf`, `round2`, and `computeWithdrawal` are the current fee/calculation helpers and must be reconciled before changing the financial contract
- `base44/shared/auditLog.ts`
  - server-side audit writer used by withdrawal and donation verification paths
- `base44/shared/accountGuard.ts`
  - active-account guard used before action dispatch

## Current safety behavior already present in source

- Approval, reconciliation, release, and pending-donation clearing are admin-only based on the authenticated server-side user role.
- Provider ambiguity is represented as `provider_status_unknown`; funds remain reserved.
- Provider success followed by canonical completion failure is represented as `reconciliation_pending`; the payout is not resubmitted.
- Definitive provider failure attempts canonical cancellation and mirror release; if cancellation fails, the workflow fails closed as `reservation_release_pending`.
- Provider dispatch includes the withdrawal id as the PayPal item id.

## Gaps that require implementation evidence

The source inspection above does **not** prove:

1. A single atomic conditional claim for concurrent approve/deny requests.
2. A durable claim token/version or stale-worker fencing primitive.
3. Idempotency coverage across provider dispatch, local finalization, denial, release, ledger, and audit writes.
4. Anti-enumeration consistency for nonexistent, unrelated, and cross-campaign targets.
5. A dedicated server-side denial/moderation workflow (the visible entry point contains approval/reconciliation/release, but denial/moderation behavior must be verified from the remainder of the file and current deployed runtime).
6. Hosted RLS/authorization behavior in the target Base44 environment.
7. Exact 3% withdrawal-fee consistency across `fees.js`, persisted schema, UI copy, and tests.
8. Development runtime concurrency/recovery results.
9. Production topology parity with the visible repository or the deployed Convex backend.

## Implementation rule

Before adding or replacing behavior, inspect the complete current-main implementations of `requestWithdrawal`, `fees.js`, the relevant entity schemas, and the canonical Convex mutations. Do not infer unsupported Base44 atomic primitives from this inventory. Any promotion requires exact-head tests and separate Development evidence.
