# Convex Automation Source Reconciliation

Status: evidence boundary and implementation handoff. This document does not claim that Production has been reconciled or that Development validation has passed.

## Reported Production contention

The operational report identifies recurring write conflicts from parallel automation functions:

- `runAllAgentAutomation`
- `runCoordinatorAutomation`
- `runScoutAutomation`
- `checkSiteHealth`
- `runPostProductionAutomation`

The reported conflicts repeatedly involve `cron_commit_mut...` documents.

## Repository verification at this checkpoint

The visible `interplanetarysister/interplanetary-fund2` source was searched for the exact function names and the `cron_commit_mut` identifier. No matching implementation was found in the GitHub source currently accessible to this branch review.

This is an evidence boundary, not proof that the functions or documents do not exist in a deployed Convex environment. Do not overwrite, delete, or replace deployed behavior based only on this repository search.

## Required reconciliation before implementation

1. Capture the exact Production Convex function paths, deployed revision, cron definitions, and table/schema names for the five reported paths.
2. Capture the Development function paths and confirm whether Development contains the same orchestration.
3. Compare every shared write target, especially `cron_commit_mut...` documents, agent state, `distributedPosts`, health records, and any shared lock/lease records.
4. Identify whether the deployed implementation is ahead of, behind, or divergent from this repository before changing behavior.
5. Preserve any deployed functionality that is absent from GitHub until an authoritative source is established.

## Safe repair requirements after reconciliation

The repair must address the cause, not only symptoms:

- one active claim per logical automation run;
- durable idempotency key for each logical run and side effect;
- stale-worker fencing or lease expiry that prevents an old worker from committing;
- duplicate-run prevention across overlapping cron triggers;
- serialized writes for shared commit/coordination records;
- bounded retries only for retryable conflicts, with observable terminal failure;
- no duplicate posts, ledger entries, payouts, or releases on replay;
- explicit Development validation before any Production promotion.

## Promotion gate

No Production change is authorized from this document alone. Promotion requires exact deployed-versus-source reconciliation, Development implementation and runtime evidence, fresh Agent 2+3 review of the exact commit, Agent 1 correction/verification, and Agent 3 final review.
