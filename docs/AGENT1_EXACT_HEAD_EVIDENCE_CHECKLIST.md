# Agent 1 Exact-Head Evidence Checklist

This checklist is a release gate, not runtime evidence by itself.

## Exact-head identity

- Record the PR number, branch, base branch, base SHA, and head SHA.
- Re-run every verifier and test against the recorded head SHA.
- Mark all evidence from any earlier head as superseded.
- Confirm the PR head has not moved before interpreting results.

## Convex source/deployment reconciliation

- Inventory the deployed Convex functions, cron jobs, schema/indexes, environment bindings, and route topology.
- Inventory the visible canonical GitHub source at the same release candidate.
- For each deployed item, classify it as `MATCHED`, `SOURCE_ONLY`, `DEPLOYED_ONLY`, or `UNKNOWN`.
- Never delete or replace a `DEPLOYED_ONLY` or `UNKNOWN` item based only on repository search results.
- Block Production promotion until every `DEPLOYED_ONLY`/`UNKNOWN` item has an owner and reconciliation decision.

## Automation contention and side effects

For `runAllAgentAutomation`, `runCoordinatorAutomation`, `runScoutAutomation`, `checkSiteHealth`, and `runPostProductionAutomation`:

- Identify every shared write target, including `cron_commit_mut...`, agent state, and `distributedPosts`.
- Use a durable scope key for each logical run and side effect.
- Claim work conditionally before performing external or financial side effects.
- Fence stale workers with an expiry/lease token or equivalent generation check.
- Make retries idempotent and bounded; retries must not be the primary conflict strategy.
- Prove duplicate invocations converge to one committed outcome.

## Financial and moderation gates

- Concurrent approve/deny has exactly one durable winner.
- PayPal dispatch has one deterministic provider intent per withdrawal.
- Provider success followed by local finalization failure is recoverable without resubmission.
- Non-success and unknown provider states do not become local `paid`.
- Reservation release is idempotent and recoverable after partial failure.
- Moderation transitions are server-authorized, conditional, and replay-safe.
- All privileged paths reject anonymous, unrelated, cross-campaign, malformed, and client-forged requests.
- Fee/ledger behavior matches the canonical 7% contract and authoritative totals.

## Evidence classification

- `STATIC_CI`: source/build/verifier result only.
- `DEVELOPMENT_RUNTIME`: observed execution against the Development deployment, including raw logs/records.
- `PRODUCTION_RECONCILIATION`: observed deployed topology and source comparison.
- `PUBLICATION_APPROVAL`: fresh Agent 2+3 audit plus Agent 1 correction/verification plus Agent 3 final review.

Do not label a gate accomplished unless the evidence class required by that gate is attached and tied to the exact PR head.
