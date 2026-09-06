# Agent 1 — Current-main financial/provider reconciliation

## Scope

This document records the release gate for PR #143 after `main` advanced beyond the PR's original base. It is evidence control, not runtime proof.

## Exact-head rule

Only checks executed against the current PR head and current `main` base are valid for publication. Evidence from superseded PR heads or stale PR #88 is invalid.

## Required reconciliation before publication

1. Compare the current PR head with current `main` for donation/provider-reference semantics.
2. Re-run the Fraud Approval Workflow Verification, Terms Liability Verification, and Production Quality Gates on the reconciled head.
3. Re-audit PayPal capture/idempotency behavior and confirm the deterministic payout reference remains unique.
4. Prove Development behavior for concurrent approve/deny, provider-success/local-finalization failure recovery, non-success/unknown provider states, denial reservation-release retry, duplicate payout/release prevention, and moderation authorization/idempotency.
5. Reconcile deployed Convex functions, cron topology, schema, and environment with visible canonical source before any Production promotion.

## Evidence classification

- **STATIC CI:** repository workflow result on the exact reconciled head.
- **DEVELOPMENT RUNTIME:** executed against the Development deployment, including failure injection and concurrency tests.
- **PRODUCTION RECONCILIATION:** observed deployed topology/source comparison; never inferred from source or CI.
- **FINAL APPROVAL:** fresh Agent 2+3 audit followed by Agent 1 correction/verification and Agent 3 publication review.

## Non-claims

This document does not claim that any runtime test, deployment reconciliation, review approval, merge, or Production promotion has occurred.
