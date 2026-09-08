# Base44 Fraud Workflow Contract

Status: implementation contract for the focused current-main branch.

## Scope

This branch is intentionally limited to the authoritative Base44 application. It does not alter, deploy, or reconcile Convex/Vercel runtime behavior.

## Required invariants

1. **Server authority**: approve/deny decisions are performed by authenticated server-side actions; clients cannot supply actor, role, campaign scope, or final outcome.
2. **Fraud-review authorization**: fraud-held withdrawal approval/denial is restricted to an authenticated admin/fraud-review role derived server-side. Campaign owners/operators may request withdrawal or submit evidence, but may not approve or deny the hold, including for their own campaign. Unrelated users, cross-campaign attempts, and callers with forged role/actor fields fail with the same bounded error shape as nonexistent targets.
3. **Single winner**: the decision transition is conditional on the current pending state and uses a durable claim token/version so concurrent approve/deny requests have exactly one winner.
4. **Idempotency**: provider dispatch, local finalization, denial, reservation release, ledger writes, and audit writes use stable idempotency keys and are safe to retry.
5. **Provider truth**: non-success and unknown provider states remain pending/failed/unknown; provider success followed by local finalization failure is recoverable without resubmitting a second payout.
6. **Financial contract**: the approved platform fee is 3% at withdrawal. All schema fields, calculations, UI copy, assertions, and tests must use the same contract.
7. **Auditability**: financial and moderation audit records retain immutable actor, action, reason, timestamp, target, and idempotency evidence.
8. **Evidence boundaries**: static checks, source inspection, and CI are not Development runtime proof; Development runtime evidence is not Production evidence.

## Required verification matrix

- anonymous caller
- unrelated authenticated caller
- campaign owner/operator attempting approval
- campaign owner/operator attempting denial
- cross-campaign caller
- forged role / forged actor fields
- replayed approve
- replayed deny
- concurrent approve/deny
- stale-worker takeover
- provider failure
- provider non-success / unknown state
- provider success with local-finalization failure
- duplicate payout prevention
- duplicate reservation-release prevention
- moderation idempotency and authorization
- mobile-safe bounded error state

## Promotion gates

Do not mark complete, request merge, or promote until the exact branch head has:

- current-main compatibility review;
- Node 24 exact-head checks;
- Development runtime evidence for every scenario above;
- direct-backend authorization/RLS evidence;
- schema/fee/ledger reconciliation;
- independent Agent 2+3 review;
- Agent 1 correction and verification;
- Agent 3 final review.
