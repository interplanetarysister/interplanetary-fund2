# Agent 1 Current-Head Handoff

This document is a release-gate artifact for the fraud/payout review branch. It is intentionally evidence-oriented and must be updated when the PR head changes.

## Exact target

- Repository: `interplanetarysister/interplanetary-fund2`
- Pull request: `#143`
- Required audit target: the exact current PR head SHA reported by GitHub at the time of review
- Base: current `main` at the time of the audit

Do not reuse CI, review, runtime, or deployment evidence from an earlier head or from stale PR #88.

## Evidence classes

| Class | What it proves | What it does not prove |
| --- | --- | --- |
| Static source review | Source-level invariants and expected control flow | Development runtime behavior or deployed Convex state |
| Exact-head CI | Checks ran against the reviewed commit | Development runtime, Production topology, or production safety |
| Development runtime | Concurrent/replay/failure-recovery behavior in Development | Production deployment equivalence |
| Production reconciliation | Which functions, crons, schema, and environment are actually deployed | That the new source is safe without Development validation |
| Final publication review | Full workflow completion and no remaining blockers | Anything not explicitly evidenced in the review record |

## Mandatory blockers before merge or promotion

- Fresh exact-head Agent 2+3 audit with concrete findings, not only a restart/checkpoint.
- Development proof for concurrent approve/deny single-winner behavior.
- Development proof for provider-success/local-finalization failure recovery without payout resubmission.
- Development proof for non-success and unknown provider states.
- Development proof for retryable reservation-release failure and idempotent release.
- Development proof that duplicate payout and duplicate release cannot occur on replay.
- Development proof for moderation authorization and idempotency.
- Durable uniqueness/atomic claiming across every financial side effect, not just a deterministic provider identifier.
- Reconciliation with the canonical platform-fee/ledger contract and current schema/status enums.
- Server-side authorization/RLS and anti-enumeration checks for every admin/fraud-control entry point, including direct invocation and legacy paths.
- Deployed-versus-source Convex reconciliation for the named automation paths, shared `cron_commit_mut...` writes, agent state, `distributedPosts`, cron topology, and environment before any Production behavior change.
- Final Agent 3 publication review.

## Reporting rules

Report each item as exactly one of:

- **ACCOMPLISHED** — supported by exact commit, exact head, and the required evidence class.
- **TRUNCATED / INCOMPLETE** — some work exists, but required evidence or workflow gates are missing.
- **AWAITING START / BLOCKED** — not started or blocked on an external dependency/evidence source.

Never label static docs, source changes, or CI as Development runtime or Production proof.

## Current safety posture

Keep PR #143 Draft until all mandatory blockers are satisfied and the PR head is re-verified immediately before any merge or Production promotion. Do not overwrite or delete deployed functionality that is absent from the visible source without an explicit reconciliation record.
