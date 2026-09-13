# Convex Automation Concurrency Reconciliation Runbook

## Status

This is an evidence and promotion-gate document. It does **not** claim that the affected Production implementation is present in `interplanetary-fund2`, nor that any repair has been deployed. Status values are limited to `UNRESOLVED`, `AWAITING_START`, `IN_PROGRESS`, `TRUNCATED / INCOMPLETE`, and `ACCOMPLISHED`; `ACCOMPLISHED` is permitted only after implementation is merged/published, Development validation passes, and Production promotion plus observation are verified.

## Incident scope

Production has reported recurring write conflicts between parallel automation functions and `cron_commit_mut...` documents involving:

- `runAllAgentAutomation` — 24 retries reported
- `runCoordinatorAutomation` — 13 retries reported
- `runScoutAutomation` — 8 retries reported
- `checkSiteHealth` — 3 retries reported
- `runPostProductionAutomation` — 2 retries reported

The visible `interplanetary-fund2` source must not be treated as the deployed Convex source unless an authoritative deployment/source mapping proves that relationship.

## Source-of-truth gates

Before changing Production behavior, record all of the following. Each item is independently `RESOLVED` or `UNRESOLVED` with an evidence link and owner; missing evidence must not be inferred.

| Gate | Required artifact | Minimum evidence | Owner | Status |
|---|---|---|---|---|
| Deployed identity | Convex Production and Development deployment/environment identifiers | dashboard/export/API evidence with deployment timestamp and revision/artifact hash | Convex owner | `UNRESOLVED` |
| Canonical repository mapping | exact GitHub repository, branch, commit, and files owning deployed functions | source URL/commit plus deployment linkage, or explicit external-owner record | Convex owner | `UNRESOLVED` |
| Schema/index mapping | deployed definitions for automation state, cron commit/mutation records, agent state, and `distributedPosts` | schema export or equivalent runtime evidence naming fields, indexes, uniqueness, and retention | Convex owner | `UNRESOLVED` |
| Scheduler/configuration mapping | all cron, webhook, manual, and post-production triggers | scheduler export/logs showing cadence, retry budget, concurrency, and trigger owner | Operations owner | `UNRESOLVED` |
| Promotion boundary | separate Development and Production promotion records | exact candidate revision, deploy log, and rollback target for each environment | Release owner | `UNRESOLVED` |

If any item is unavailable, mark it `UNRESOLVED` and do not infer or overwrite the missing implementation.

## Mandatory implementation invariants

The eventual repair must satisfy all invariants below; these are mandatory, not preferences:

- **One durable logical-job key:** every cron, manual, webhook, and post-production invocation derives the same stable key from function identity, target scope, and logical execution window.
- **One authoritative claim record/index:** a single durable claim record or equivalent unique index owns each logical-job key. Process-local locks are not sufficient.
- **Atomic claim:** acquisition is compare-and-set or an equivalent atomic unique-constraint transaction that cannot allow two active owners for the same key.
- **Lease and fencing:** each claim has a run token and expiry. Every shared write must validate the current token/lease; stale workers must fail closed and cannot write after lease loss.
- **Idempotent side effects:** target writes and emitted side effects use stable idempotency keys so retry or response loss converges without duplicates.
- **Explicit trigger ownership:** each affected function has one declared orchestration owner; duplicate trigger paths must share the same claim/idempotency boundary.
- **Write partitioning:** coordination state is separated from per-target side effects where possible; unrelated automations must not mutate one shared coordination document in the same transaction.
- **Bounded retry semantics:** retry only transient conflict/transport failures, with jitter/backoff and a finite attempt budget. Do not retry validation, authorization, or schema failures.

## Required durable schema contract

The implementation must document and validate an equivalent durable schema before code approval. Names may differ only if the mapping is explicit and tested.

### Logical job / claim record

Required fields:

- `logicalJobKey` — canonical unique key for function + target scope + execution window.
- `triggerType` — `cron | manual | webhook | postProduction`.
- `targetScope` — bounded canonical scope identifier.
- `windowStart` / `windowEnd` — UTC execution window boundaries.
- `status` — `pending | claimed | running | succeeded | failed | expired`.
- `claimToken` — unique opaque fencing token for the current owner.
- `claimOwner` — bounded worker/run identifier.
- `leaseExpiresAt` — UTC timestamp.
- `attemptCount` and `maxAttempts` — finite retry budget.
- `lastErrorClass` — bounded reason class; never raw exception payload.
- `idempotencyKey` — stable side-effect key derived from logical job + target operation.
- `createdAt`, `updatedAt`, `completedAt` — UTC timestamps.

Required uniqueness/index semantics:

- unique index on `logicalJobKey`;
- unique index on `idempotencyKey` for each side-effect namespace;
- indexed lookup on active lease (`status` + `leaseExpiresAt`);
- atomic claim must update `status`, `claimToken`, `claimOwner`, `leaseExpiresAt`, and `attemptCount` only when the prior record is claimable (`pending` or expired `claimed/running`).

### Shared-write fencing rule

Every write touching `cron_commit_mut...`, agent state, `distributedPosts`, or a derived side-effect record must validate the current `logicalJobKey` and `claimToken` in the same transaction or equivalent atomic compare-and-set. A worker with an expired, replaced, or mismatched token must receive a durable `stale_worker_rejected` result and must not write.

### `cron_commit_mut...` boundary

The deployed schema mapping must answer, with evidence, whether `cron_commit_mut...` is:

1. the claim record,
2. a commit ledger that must be append-only, or
3. another shared mutable coordination document.

If it is a shared mutable document, the repair must either partition writes away from it or prove atomic field-level compare-and-set plus fencing. Blind retries against the same record are not an acceptable repair.

## Required Development validation

Development validation is incomplete until the exact candidate revision is deployed to a named Development environment and each affected function has executable evidence for:

- same logical-job key invoked concurrently;
- different logical-job keys invoked concurrently;
- conflict retry and eventual convergence;
- response loss after a committed write and safe replay;
- stale lease/fencing-token write rejection;
- duplicate cron/manual/webhook/post-production trigger suppression;
- partial failure in one target while other targets continue safely;
- `distributedPosts` and agent-state consistency;
- zero duplicate side effects and zero lost side effects in the tested scenarios;
- bounded conflict retries: no more than the configured finite budget, with final durable status;
- authorization and service-role boundaries unchanged.

Record numeric thresholds for the candidate revision:

- duplicate side effects: `0` accepted;
- lost side effects: `0` accepted;
- stale-worker shared writes: `0` accepted;
- conflict retries: within configured finite budget for every test case;
- unresolved/failed jobs: visible in durable status with a reason class and next-action state.

Capture exact repository commit, deployed function revision/hash, harness command, timestamps, and before/after conflict counts. Static inspection, a clean build, or a passing unit test alone is not runtime proof.

## Observability and rollback acceptance

Before Production promotion, define and test:

- counters for `claim_conflict`, `stale_worker_rejected`, `duplicate_suppressed`, `retry_exhausted`, `lost_side_effect_detected`, `partial_failure`, and final job outcomes;
- alert thresholds: any non-zero lost-side-effect or stale-worker write, any duplicate side effect, any retry-budget exhaustion on a successful-path test, or a renewed `cron_commit_mut...` conflict rate above the pre-repair baseline for two consecutive schedule windows is a release blocker;
- dashboards or query paths that identify the affected function, logical-job key, deployment revision, and run token;
- a rollback artifact and exact rollback owner/command, with a tested restore to the last known-good revision;
- a post-promotion observation window covering at least two executions of every affected schedule, with go/no-go thresholds of zero duplicate/lost side effects, zero stale-worker writes, no retry-budget exhaustion, and no renewed conflict storm.

## Production promotion gate

Production promotion is allowed only after:

1. Development source/deployment identity is recorded.
2. The authoritative repository/schema/index/scheduler mapping is resolved or explicitly documented as external to this repository.
3. The Development matrix above passes against the exact candidate revision.
4. Agent 2 reviews the implementation and evidence.
5. Agent 1 resolves all valid findings and re-verifies the exact head.
6. Agent 3 performs the final audit/publication review.
7. Production deployment identity, rollback plan, alert thresholds, and observation window are recorded.
8. The post-promotion observation window confirms no renewed collision storm and meets the numeric thresholds above.

Until every gate is complete, status is `AWAITING_START`, `IN_PROGRESS`, or `TRUNCATED / INCOMPLETE`, never `ACCOMPLISHED`.

## Evidence record template

- Overall status:
- Repository / branch / commit:
- Convex Development deployment / revision:
- Convex Production deployment / revision:
- Deployed function/source mapping:
- Schema/index mapping:
- Cron/scheduler/trigger mapping:
- Logical-job key definition:
- Claim record/index definition:
- Lease/run-token/fencing semantics:
- Reproduction harness and command:
- Conflict counts before:
- Conflict counts after:
- Duplicate side-effect result:
- Lost side-effect result:
- Stale-worker rejection result:
- Retry-budget result:
- Observability/alert evidence:
- Rollback reference:
- Agent 2 review reference:
- Agent 1 correction reference:
- Agent 3 final review reference:
- Production promotion decision:
- Observation-window result:
