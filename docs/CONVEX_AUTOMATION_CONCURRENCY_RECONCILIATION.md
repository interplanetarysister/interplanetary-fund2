# Convex Automation Concurrency Reconciliation Runbook

## Status

This is an evidence and promotion-gate document. It does **not** claim that the affected Production implementation is present in `interplanetary-fund2`, nor that any repair has been deployed.

## Incident scope

Production has reported recurring write conflicts between parallel automation functions and `cron_commit_mut...` documents involving:

- `runAllAgentAutomation` — 24 retries reported
- `runCoordinatorAutomation` — 13 retries reported
- `runScoutAutomation` — 8 retries reported
- `checkSiteHealth` — 3 retries reported
- `runPostProductionAutomation` — 2 retries reported

The visible `interplanetary-fund2` source must not be treated as the deployed Convex source unless an authoritative deployment/source mapping proves that relationship.

## Source-of-truth gates

Before changing Production behavior, record all of the following:

1. **Deployed identity** — Convex deployment/environment, deployed function names, deployment timestamp, and the source revision or artifact that produced it.
2. **Canonical repository mapping** — the exact GitHub repository, branch, commit, and files that own the deployed functions.
3. **Schema mapping** — the deployed definitions for automation state, cron commit/mutation records, agent state, and `distributedPosts`, including indexes/uniqueness constraints used by writes.
4. **Configuration mapping** — cron schedules, retries, concurrency settings, and any external scheduler or webhook that can invoke the same work.
5. **Promotion boundary** — Development and Production deployment identifiers must be recorded separately; a clean Development result is not evidence that Production has been changed.

If any item is unavailable, mark it `UNRESOLVED` and do not infer or overwrite the missing implementation.

## Required Development-first repair design

The repair must address the underlying collision rather than increase retries. The preferred design is:

- **Single-flight claim:** create or atomically update a claim record keyed by logical job identity and execution window before doing shared writes.
- **Lease/fencing:** include a unique run token and expiry; stale workers must fail their writes when the token is no longer current.
- **Idempotency:** derive stable keys from job/function identity, target entity, and logical execution window. Retries must converge on the same claim and side-effect records.
- **Write partitioning:** avoid unrelated automations mutating the same coordination document in one transaction where possible; isolate job state from per-target side effects.
- **Bounded retry semantics:** retry only transient conflicts, with jitter/backoff and a finite attempt budget; do not retry validation, authorization, or schema failures.
- **Duplicate-run prevention:** cron, webhook, manual, and post-production paths must share the same claim/idempotency boundary.

## Validation matrix

Development validation is incomplete until each affected function has evidence for:

- concurrent invocation with the same logical job key;
- concurrent invocation with different logical job keys;
- retry after conflict;
- response loss after commit;
- stale lease/fencing token;
- duplicate cron/manual trigger;
- partial failure in one target while other targets continue safely;
- `distributedPosts` and agent-state writes remaining consistent;
- no duplicate side effects and no lost side effects;
- bounded conflict retries and observable final status;
- authorization and service-role boundaries unchanged.

Capture exact commit/deployment identifiers and before/after conflict counts. Do not label the repair complete from static inspection alone.

## Production promotion gate

Production promotion is allowed only after:

1. Development source/deployment identity is recorded.
2. The Development matrix above passes against the exact candidate revision.
3. Agent 2 reviews the implementation and evidence.
4. Agent 1 resolves all valid findings and re-verifies the exact head.
5. Agent 3 performs the final audit/publication review.
6. The Production deployment identity and rollback plan are recorded.
7. A post-promotion observation window confirms no renewed collision storm.

Until those gates are complete, status is `AWAITING_START` or `TRUNCATED / INCOMPLETE`, never `ACCOMPLISHED`.

## Evidence record template

- Repository / branch / commit:
- Convex Development deployment:
- Convex Production deployment:
- Function/source mapping:
- Schema/index mapping:
- Cron/scheduler mapping:
- Reproduction command or harness:
- Conflict counts before:
- Conflict counts after:
- Duplicate-side-effect result:
- Agent 2 review reference:
- Agent 1 correction reference:
- Agent 3 final review reference:
- Production promotion decision:
- Rollback reference:
