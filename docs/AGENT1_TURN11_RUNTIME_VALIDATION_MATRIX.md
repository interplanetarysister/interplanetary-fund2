# Agent 1 Turn 11 — Runtime Validation Matrix

This document is a release-gate checklist for the current PR head. It is not runtime evidence by itself.

## Exact-head rule

- Validate only the exact PR head recorded in the handoff comment and CI run.
- Superseded commits, stale PRs, static source inspection, Vercel status, and repository CI are not Development or Production runtime proof.
- If a required runtime fact cannot be observed, record it as `UNKNOWN` or `AWAITING START`; do not infer success.

## Convex concurrency repair gate

Before changing or promoting production behavior, reconcile deployed Convex with the visible canonical backend/source for:

- `runAllAgentAutomation`
- `runCoordinatorAutomation`
- `runScoutAutomation`
- `checkSiteHealth`
- `runPostProductionAutomation`
- cron topology and shared `cron_commit_mut...` writes
- agent state and `distributedPosts`

Development validation must demonstrate safe serialization or claiming, stale-worker fencing, idempotency, duplicate-run prevention, bounded retry semantics, and recovery after partial failure. Increasing retries alone does not satisfy this gate.

## Financial workflow gate

Development validation must cover:

1. Concurrent approve/deny has one authoritative winner.
2. Provider success followed by local finalization failure is recoverable without resubmitting the payout.
3. Non-success and unknown provider states do not produce local `paid` state.
4. Denial reservation release is idempotent and retryable after partial failure.
5. Duplicate payout and duplicate release attempts do not create duplicate effects.
6. Campaign moderation requires server-side authorization and is idempotent.
7. Current-main payment/provider-reference and canonical fee/ledger behavior remain compatible.

## Reporting boundaries

- `ACCOMPLISHED`: backed by exact commit/PR/CI/runtime evidence.
- `TRUNCATED / INCOMPLETE`: started or partially verified but missing required evidence.
- `AWAITING START`: no valid implementation or validation evidence yet.

Do not mark this matrix complete until the corresponding evidence is attached to the PR with exact commit/environment references.
