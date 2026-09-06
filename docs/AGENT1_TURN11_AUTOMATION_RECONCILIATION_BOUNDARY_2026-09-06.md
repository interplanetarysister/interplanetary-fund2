# Agent 1 Turn 11 — Automation Reconciliation Boundary

## Scope

This checkpoint records the exact evidence boundary for the current PR head. It is a release-control artifact, not a claim that the Convex concurrency repair is complete.

## Required exact-head evidence

All review, test, and audit claims must target the exact PR head reported by GitHub at the time of the check. Evidence from superseded heads, stale PRs, or historical base references is non-authoritative.

## Production/source safety

Before changing Production behavior, reconcile the actually deployed Convex application with the visible canonical source. The reconciliation must explicitly cover:

- `runAllAgentAutomation`
- `runCoordinatorAutomation`
- `runScoutAutomation`
- `checkSiteHealth`
- `runPostProductionAutomation`
- cron topology and overlapping schedules
- shared `cron_commit_mut...` writes
- agent state records
- `distributedPosts` and other shared side-effect records
- schema and environment differences

If a deployed function, schema, or cron is not present in visible source, record it as `UNKNOWN` and do not overwrite or delete it by inference.

## Concurrency acceptance criteria

The repair is not complete until Development evidence demonstrates, under controlled concurrent invocation:

1. one authoritative winner for each consequential claim;
2. stale-worker fencing before external or irreversible side effects;
3. idempotent retries with bounded backoff;
4. duplicate-run prevention for posts, payouts, releases, and moderation actions;
5. safe recovery when provider success is followed by local finalization failure;
6. safe recovery when reservation release is partial or interrupted;
7. no reliance on increasing retry counts as the primary fix.

## Evidence classes

- `STATIC_CI`: source checks and workflow success only.
- `DEVELOPMENT_RUNTIME`: observed behavior from the Development deployment.
- `PRODUCTION_RECONCILIATION`: evidence of what Production is actually running and how it maps to source.
- `PUBLICATION_APPROVAL`: final combined Agent 2+3 review plus Agent 3 publication review.

Do not promote or merge based on a lower evidence class when a higher class is required.

## Reporting boundary

Agent 3 may report a work item as **ACCOMPLISHED** only when the required evidence class is complete. Otherwise classify it as **TRUNCATED / INCOMPLETE** or **AWAITING START**. This file intentionally does not claim the underlying Convex repair, Development runtime validation, Production reconciliation, authorization/RLS proof, or financial-contract reconciliation are complete.
