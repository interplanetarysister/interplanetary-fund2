# Base44 Fraud Workflow Test Matrix

Status: implementation/test contract only. This matrix is not runtime evidence and must not be reported as Development or Production validation.

## Authorization boundaries

| Scenario | Expected result |
| --- | --- |
| Authenticated admin/fraud-review reviewer approves a fraud-held withdrawal | Server action may proceed, subject to claim/idempotency checks |
| Campaign owner attempts to approve the campaign's held withdrawal | Denied server-side; no status, reservation, ledger, provider, or audit mutation |
| Campaign operator attempts to deny the campaign's held withdrawal | Denied server-side; no mutation |
| Caller supplies forged `role`, `actor_id`, or `is_admin` fields | Ignored; role and actor are derived from authenticated server context |
| Reviewer targets a withdrawal from another campaign outside their permitted scope | Denied without leaking whether the record exists |
| Unauthenticated caller invokes approve, deny, freeze, or unfreeze | Denied without mutating state |

## Concurrency and replay

| Scenario | Expected result |
| --- | --- |
| Two valid reviewers approve the same withdrawal concurrently | Exactly one durable claim wins; at most one provider dispatch is allowed |
| A stale worker resumes after lease expiry or claim replacement | Fenced from finalization and provider/local side effects |
| Same idempotency key is retried after provider success but before local finalization | Reconciles the existing provider result; never dispatches a second payout |
| Same idempotency key is retried after provider rejection/unknown result | Returns the recorded provider outcome and does not silently convert it to success |
| Denial is retried with the same idempotency key | One denial transition, one reservation release, one immutable audit event |
| Release is retried after a partial failure | Safe replay; no double credit, duplicate ledger entry, or second release |

## State integrity

- `under_review`, `approved`, `denied`, `reconciliation_pending`, `paid`, `failed`, and `released` remain distinct states.
- Provider acceptance is not treated as local finalization; reconciliation remains explicit.
- Reservation, ledger, payout, and audit writes must be durable and replay-safe.
- Audit evidence records the authenticated reviewer, action, target, reason, idempotency key, prior state, resulting state, and timestamps.
- Client controls remain disabled or fail closed until the corresponding server-side action exists.

## Required evidence before sign-off

1. Exact source files and schemas for every entity/function writer.
2. A supported atomic conditional/unique claim primitive from the actual Base44 runtime.
3. Node 24 exact-head static checks.
4. Development runtime evidence for authorization negatives, concurrent approval, provider/local-finalization recovery, denial/release replay, and anti-enumeration.
5. Fresh combined Agent 2+3 review of the exact implementation commit, followed by Agent 1 verification and Agent 3 final review.
