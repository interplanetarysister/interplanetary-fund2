# Development Validation Matrix

This document is an evidence template, not a claim that any runtime gate has passed.

## Evidence rules

- Record the exact commit SHA, Convex deployment/environment, test timestamp, and operator.
- Static CI and repository source inspection are not Development runtime proof.
- A missing deployed artifact is **UNKNOWN** until the deployed function, cron, schema, and environment inventory is obtained.
- Do not promote to Production until every required row has reproducible Development evidence and the source/deployment reconciliation is complete.

## Automation concurrency

| Area | Required scenario | Required invariant | Evidence |
| --- | --- | --- | --- |
| `runAllAgentAutomation` | Two overlapping invocations | One durable winner; no duplicate side effects | Pending |
| `runCoordinatorAutomation` | Two overlapping invocations | One durable winner; loser exits safely | Pending |
| `runScoutAutomation` | Two overlapping invocations | No duplicate posts or claims | Pending |
| `checkSiteHealth` | Parallel checks | Shared records remain consistent | Pending |
| `runPostProductionAutomation` | Parallel post-production runs | No duplicate distributed post or agent-state mutation | Pending |
| `cron_commit_mut...` | Multiple writers | Writes are serialized or safely claimed | Pending |
| stale worker | Lease expires during work | Stale worker cannot commit after takeover | Pending |
| retry | Transient conflict/error | Retry is bounded, idempotent, and observable | Pending |

## Financial workflows

| Area | Required scenario | Required invariant | Evidence |
| --- | --- | --- | --- |
| approval/denial | Concurrent approve and deny | Exactly one terminal decision | Pending |
| payout | Repeated approval retry | One provider payout identity and one local side effect | Pending |
| provider success | Provider succeeds; local finalization fails | Recovery finalizes locally without resubmission | Pending |
| provider non-success | Failed/cancelled/unknown provider status | No local `paid` authorization | Pending |
| reservation release | Release fails or is retried | No negative balance or duplicate release | Pending |
| fee/ledger | 7% fee calculation | Gross, fee, and net remain consistent | Pending |

## Authorization and moderation

| Area | Required scenario | Required invariant | Evidence |
| --- | --- | --- | --- |
| admin authorization | Missing/invalid/legacy credential | Denied without privileged side effect | Pending |
| moderation | Repeated approve/deny | Idempotent state transition with actor/reason/timestamp | Pending |
| ownership | Caller targets another user's record | Server rejects unauthorized access | Pending |
| rate limiting | Burst of privileged requests | Durable or deployment-safe enforcement | Pending |

## Source/deployment reconciliation

Capture the following before Production promotion:

1. Deployed Convex function inventory and versions.
2. Deployed cron topology and schedules.
3. Deployed schema/index inventory.
4. Environment variables and external provider configuration names (never secrets).
5. Comparison against canonical backend source commit.
6. Any deployed-only function or schema: owner, purpose, replacement plan, and explicit approval.

## Reporting handoff

Use only these labels in PR comments and the 24-hour report:

- **ACCOMPLISHED** — backed by an exact commit, exact CI run, or exact Development/Production evidence.
- **TRUNCATED / INCOMPLETE** — started or partially complete, with the missing evidence named.
- **AWAITING START / BLOCKED** — not started or blocked by missing access/reconciliation/review.
