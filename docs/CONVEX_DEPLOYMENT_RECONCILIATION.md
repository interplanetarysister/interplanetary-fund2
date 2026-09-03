# Convex Deployment Reconciliation Runbook

## Purpose

This runbook prevents source-of-truth drift before any Development or Production Convex change. It is evidence-driven: absence from the visible GitHub tree is **UNKNOWN**, not proof that a deployed function or cron does not exist.

## Required evidence order

1. Record the exact repository, branch, PR, commit, and target Convex deployment.
2. Export or inspect the deployed function list, cron schedule, schema, environment bindings, and deployment version from the Convex deployment itself.
3. Compare deployed functions and scheduled jobs with the canonical backend source at the exact commit under review.
4. For every mismatch, classify it as `source-only`, `deployed-only`, `renamed`, `version-drift`, or `UNKNOWN`.
5. Do not delete, overwrite, or promote a `deployed-only` capability until ownership, replacement, rollback, and data-compatibility are documented.

## Automation concurrency checklist

For every automation entry point and shared record family, capture:

- Trigger source and schedule.
- Claim/lease key and uniqueness boundary.
- Idempotency key and replay behavior.
- Fencing/lease-expiry behavior.
- Retry classification: safe retry, delayed retry, or manual reconciliation.
- Records written, including agent state, distributed posts, and any `cron_commit_mut...` documents.
- Conflict behavior under two or more simultaneous invocations.
- Recovery behavior after a provider side effect succeeds but local finalization fails.

## Development validation matrix

Record exact deployment name, commit, timestamps, invocation IDs, and resulting records for:

- Concurrent automation invocations: one winner, no duplicate side effects.
- Concurrent fraud approve/deny: one terminal decision.
- Provider success followed by local finalization failure: retry finalization without resubmitting the provider side effect.
- Non-success or unknown provider status: local state does not become paid.
- Reservation release after partial failure: retryable and idempotent, with no double release or stranded funds.
- Duplicate payout/release replay: rejected or treated as an idempotent no-op.
- Moderation authorization: anonymous, ordinary user, administrator, and direct backend invocation paths.

## Promotion gate

Production promotion is allowed only when:

- The deployed-versus-source reconciliation is attached to the PR.
- Development evidence covers the complete matrix above.
- Static CI is green for the exact PR head.
- Agent 2+3 audit and Agent 3 publication review are complete for the exact PR head.
- The PR head has not changed since final audit.
- Rollback and post-promotion monitoring steps are documented.

## Reporting labels

Use only these labels in PR comments and reports:

- **ACCOMPLISHED** — supported by exact commit/runtime evidence.
- **TRUNCATED / INCOMPLETE** — started or partially verified but not complete.
- **AWAITING START** — not yet performed.
- **UNKNOWN** — cannot be established from currently accessible evidence.
