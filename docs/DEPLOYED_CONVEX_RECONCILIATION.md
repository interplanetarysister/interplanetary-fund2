# Deployed Convex Reconciliation Gate

This document is an evidence template for reconciling deployed Convex behavior with the visible canonical source before any production behavior change.

## Rules

- Never infer deployed behavior from filenames, stale documentation, static CI, Vercel status, or a successful local build.
- Record Development and Production separately.
- Do not delete or overwrite deployed functionality that is absent from the visible source until ownership, replacement, and rollback are verified.
- Every claimed result must identify the exact environment, timestamp, function/cron name, source revision, and observed evidence.

## Required inventory

| Area | Development evidence | Production evidence | Source reference | Status |
| --- | --- | --- | --- | --- |
| `runAllAgentAutomation` |  |  |  | UNKNOWN |
| `runCoordinatorAutomation` |  |  |  | UNKNOWN |
| `runScoutAutomation` |  |  |  | UNKNOWN |
| `checkSiteHealth` |  |  |  | UNKNOWN |
| `runPostProductionAutomation` |  |  |  | UNKNOWN |
| Cron schedules and overlapping triggers |  |  |  | UNKNOWN |
| Shared `cron_commit_mut...` writes |  |  |  | UNKNOWN |
| Agent state writes |  |  |  | UNKNOWN |
| `distributedPosts` writes |  |  |  | UNKNOWN |
| Schema/index contract |  |  |  | UNKNOWN |
| Environment variables and deployment target |  |  |  | UNKNOWN |

## Concurrency validation matrix

For each automation path, capture at least:

1. Two concurrent invocations with the same logical run key.
2. Two different invocations touching the same shared record.
3. Worker crash or timeout after claim and before completion.
4. Retry after partial completion.
5. Duplicate delivery of the same external event.
6. Stale worker attempting to write after lease expiry.

Required observations:

- Exactly one durable claim winner.
- No duplicate side effect.
- Safe retry or explicit terminal failure.
- Stale workers fenced from committing.
- Stable final state after retries settle.
- Evidence includes logs or query results, not only source inspection.

## Promotion gate

Production promotion is not permitted until:

- Development validation is complete for the reconciled topology.
- Exact source revision and deployment target are recorded.
- Agent 2+3 review is complete on the exact head.
- Agent 1 corrections and verification are complete.
- Agent 3 final publication review is complete.
- Rollback and monitoring steps are documented.
