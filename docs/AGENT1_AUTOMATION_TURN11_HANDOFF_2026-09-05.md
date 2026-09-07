# Agent 1 Automation Turn 11 — Exact-Head Handoff

Date: 2026-09-07
PR: #143
Branch: `agent1/fraud-approval-current-main`

## Verified state

- PR remains Draft, open, and unmerged.
- Latest exact PR head reported by the newest accessible Agent 2+3 audit: `bb5d7e3a1a96a71c8d6afde9949afc206a34ff5e`.
- The newest combined audit is blocking and supersedes earlier-head evidence.

## Newest combined Agent 2+3 blockers

1. Reconcile current-main/payment compatibility and rebuild/rebase the candidate from the authoritative current `main`; prior-head CI/review evidence is superseded until exact-head reconciliation is complete.
2. Add exact-head Development runtime proof for concurrent approve/deny single-winner behavior, duplicate/replayed requests, provider-success with local-finalization failure, unknown/non-success provider states, reservation-release failure/retry, duplicate payout/release prevention, and moderation authorization/idempotency.
3. Demonstrate durable side-effect coordination for payout dispatch, provider-reference binding, local finalization, reservation release, denial, moderation transitions, and audit writes using durable uniqueness/claiming, stale-worker fencing, and crash-safe retries.
4. Reconcile the canonical flat 7% platform-fee/ledger/status contract across fee helpers, withdrawals, ledger/holding-account paths, and alternate payment/migration flows.
5. Reconcile the actual deployed Convex functions, cron topology, schema, environment, shared `cron_commit_mut...` writes, agent state, and `distributedPosts` before any Production claim or promotion.
6. Add direct-backend authorization/RLS negative tests for anonymous access, ordinary users, cross-user/cross-campaign identifiers, forged administrator identity, replayed decisions, and legacy/API bypasses; audit actors must be immutable and authenticated.

## Evidence boundary

Static source inspection and GitHub Actions success are not Development runtime proof or Production proof. No Production behavior may be changed, and no deployed-only functionality may be overwritten or deleted without authoritative reconciliation.

## Required next workflow

1. Rebase/rebuild from verified current `main`.
2. Run exact-head install/codegen/typecheck/build and focused QA.
3. Perform Development validation for concurrency, idempotency, provider recovery, duplicate prevention, authorization, and fee/ledger compatibility.
4. Obtain a fresh combined Agent 2+3 audit against that exact head only.
5. Apply Agent 1 corrections and verify them.
6. Agent 3 performs final publication review.
7. Merge only if all blockers are closed, CI/status is acceptable, the final audit is complete, and the PR head is unchanged.
