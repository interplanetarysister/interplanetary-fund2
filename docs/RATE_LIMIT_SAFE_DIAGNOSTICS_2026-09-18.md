# Rate-limit safe diagnostics — 2026-09-18

## Scope
Focused correction for the raw exception disclosure in `base44/shared/rateLimit.ts`.

## Implemented
- Replaces `e.message`/raw thrown-object logging with a bounded diagnostic type classifier.
- Preserves the existing fail-open response contract.
- Does not change the limiter's read/create/update concurrency behavior.

## Deliberate boundary
This change does **not** claim to solve the RateLimitBucket race, duplicate bucket creation, lost increments, or truthfulness under concurrent load. Those remain owned by Issue #276 and blocked on #218/#310 deployed-source/schema reconciliation plus Development-first concurrency proof.

## Required review gates
- Rebaseline from exact current `main` before approval.
- Run Node 22 locked validation and focused verifier.
- Add runtime-faithful hostile thrown-value coverage and representative caller review.
- Keep Draft/open/unmerged; no merge, deployment, publication, or Production behavior change from Agent 1.
