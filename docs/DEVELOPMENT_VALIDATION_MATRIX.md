# Development Validation Matrix

This document is an evidence template, not a claim that any runtime gate has passed.

## Evidence rules

- Record the exact commit SHA, Convex deployment/environment, test timestamp, operator, and redacted record IDs.
- Static CI and repository source inspection are not Development runtime proof.
- A missing deployed artifact is **UNKNOWN** until the deployed function, cron, schema, and environment inventory is obtained.
- Do not promote to Production until every required row has reproducible Development evidence and the source/deployment reconciliation is complete.
- Unknown, timeout, provider error, or partial local-finalization outcomes must remain explicit; never reinterpret them as success.

## Required scenario ledger

| ID | Area | Required scenario | Required invariant | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| A1 | `runAllAgentAutomation` | Two overlapping invocations | One durable winner; no duplicate side effects | AWAITING START |  |
| A2 | `runCoordinatorAutomation` | Two overlapping invocations | One durable winner; loser exits safely | AWAITING START |  |
| A3 | `runScoutAutomation` | Two overlapping invocations | No duplicate posts or claims | AWAITING START |  |
| A4 | `checkSiteHealth` | Parallel checks | Shared records remain consistent | AWAITING START |  |
| A5 | `runPostProductionAutomation` | Parallel runs | No duplicate distributed post or agent-state mutation | AWAITING START |  |
| A6 | `cron_commit_mut...` | Multiple writers | Writes are serialized or safely claimed | AWAITING START |  |
| A7 | stale worker | Lease expires during work | Stale worker cannot commit after takeover | AWAITING START |  |
| A8 | retry | Transient conflict/error | Retry is bounded, idempotent, and observable | AWAITING START |  |
| F1 | approval/denial | Concurrent approve and deny | Exactly one terminal decision | AWAITING START |  |
| F2 | payout | Repeated approval retry | One provider payout identity and one local side effect | AWAITING START |  |
| F3 | provider success | Provider succeeds; local finalization fails | Recovery finalizes locally without resubmission | AWAITING START |  |
| F4 | provider non-success | Failed/cancelled/unknown provider status | No local `paid` authorization | AWAITING START |  |
| F5 | reservation release | Release fails or is retried | No negative balance or duplicate release | AWAITING START |  |
| F6 | fee/ledger | 7% fee calculation | Gross, fee, and net remain consistent | AWAITING START |  |
| S1 | admin authorization | Missing/invalid/legacy credential | Denied without privileged side effect | AWAITING START |  |
| S2 | moderation | Repeated approve/deny | Idempotent state transition with actor/reason/timestamp | AWAITING START |  |
| S3 | ownership | Caller targets another user's record | Server rejects unauthorized access | AWAITING START |  |
| S4 | rate limiting | Burst of privileged requests | Enforcement survives worker/process restart | AWAITING START |  |
| D1 | source/deployment | Compare deployed inventory with canonical source | No unexplained deployed-only function/schema remains | AWAITING START |  |

## Deployment inventory

Capture before Production promotion:

1. Development and Production Convex deployment identifiers and versions.
2. Deployed function inventory and cron schedules for both environments.
3. Deployed schema/index inventory.
4. Environment-variable and provider configuration names (never secret values).
5. Shared record/document identifiers involved in contention.
6. Comparison against the canonical backend commit.
7. Any deployed-only function/schema: owner, purpose, replacement plan, and explicit approval.

## Reporting handoff

Use only these labels in PR comments and the 24-hour report:

- **ACCOMPLISHED** — backed by an exact commit, exact CI run, or exact Development/Production evidence.
- **TRUNCATED / INCOMPLETE** — started or partially complete, with the missing evidence named.
- **AWAITING START / BLOCKED** — not started or blocked by missing access, reconciliation, or review.

## Sign-off

- Agent 1 implementation verification: `AWAITING START`
- Agent 2 independent audit: `AWAITING START`
- Agent 3 publication review: `AWAITING START`
- Production promotion authorization: `BLOCKED until all required rows have evidence`
