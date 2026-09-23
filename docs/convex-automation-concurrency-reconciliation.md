# Convex automation concurrency reconciliation

This runbook is a release gate for changes affecting automation writers, cron orchestration, agent state, or `distributedPosts`.

## Source-of-truth boundary

Do not promote a source change until the deployed Production and Development Convex deployments are identified by:

- deployment name and URL;
- deployed revision or commit mapping;
- active cron/function ownership;
- schema and index revision;
- environment-specific writer list.

If a deployed function or cron writer is absent from this repository, treat the deployment as **unreconciled**. Do not delete or replace it from source-only assumptions.

## Required Development validation

Before Production promotion, run the same concurrency harness against Development and capture raw counts for each writer:

- `runAllAgentAutomation`;
- `runCoordinatorAutomation`;
- `runScoutAutomation`;
- `checkSiteHealth`;
- `runPostProductionAutomation`.

Record, per test window:

- attempted runs;
- committed runs;
- transaction-conflict retries;
- abandoned/expired claims;
- duplicate side effects;
- idempotency-key collisions;
- maximum concurrent writers;
- final `distributedPosts` and agent-state row counts.

A green result requires that the observed conflict count and duplicate side-effect count are zero for the validated window, or that any non-zero result is explained by a known, separately tracked failure with a follow-up issue.

## Required design properties

Implementation must provide all of the following, not just higher retry counts:

1. **Serialization or sharding** so unrelated workers do not contend on one mutable commit row.
2. **Claiming** with an owner, lease, and expiry so a crashed worker cannot permanently block progress.
3. **Fencing** so an expired owner cannot commit after a newer owner has claimed the work.
4. **Idempotency** keyed by logical operation and source event, preventing duplicate posts, messages, or state transitions.
5. **Duplicate-run prevention** at the cron/orchestrator boundary so overlapping schedules do not start the same logical run twice.
6. **Bounded retries** for transient conflicts, with terminal observability when the claim or fence is stale.

## Evidence handoff

Agent 1 must link the exact commit, Development deployment identity, harness command, raw output, and interpretation in the PR. Agent 2 reviews the implementation and evidence. Agent 3 reports only what is marked `ACCOMPLISHED`; items without raw evidence remain `TRUNCATED / INCOMPLETE` or `AWAITING START`.
