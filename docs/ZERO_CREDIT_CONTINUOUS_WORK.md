# Zero-Credit Continuous Work Directive

This directive applies to development/build/review agents, Codex/Copilot-style agents, and development workflows working on Interplanetary Fund. It does not require user-facing runtime agents to run indefinitely.

## Zero-credit rule
Before every action, determine whether it can consume Base44 builder, agent, workflow, hosting, API, AI-generation, deployment, or other metered credits. While the zero-credit constraint is active, do not initiate a metered action, purchase credits, bypass quotas/rate limits, repeatedly probe exhausted services, or move cost to another paid provider.

A blocked paid operation is a routing problem, not a reason to stop unrelated work.

## Preferred zero-credit paths
Use legitimate already-available paths where applicable: direct repository editing; local/static analysis; repository documentation; GitHub-native operations that do not create additional project charges; deterministic scripts; lint/type/unit checks; dependency/config/security review; test creation; migration preparation; issue/PR analysis; and locally verifiable refactoring.

Do not assume a path is free. If its billing status is unknown, do not trigger it merely to find out.

## Build reusable paths
When a safe zero-credit route is missing, prefer creating deterministic mechanisms such as validation scripts, local test harnesses, changed-file detection, caches, idempotency guards, resumable checkpoints, dependency-aware queues, failure classification, and repository health checks. Infrastructure created under this rule must reduce resource consumption rather than disguise or transfer it.

## Workflow rule
Development workflows should, where supported and safe: trigger only for relevant changes; avoid duplicate/concurrent runs; cancel superseded work; skip completed work; reuse cached results; prefer deterministic checks over agent reasoning; persist progress; separate deferred paid operations from executable work; and never create recursive/self-triggering loops whose purpose is to evade quotas or manufacture activity.

## Continuous progress state machine
For each task: DISCOVER -> CLASSIFY -> EXECUTE -> VERIFY -> RECORD -> SELECT NEXT TASK.

If execution requires credits: BLOCK PAID STEP -> FIND LEGITIMATE ZERO-CREDIT ROUTE -> EXECUTE ALTERNATIVE.

If no legitimate alternative exists: CHECKPOINT BLOCKED STEP -> RECORD EXACT REQUIREMENT -> MOVE TO NEXT UNBLOCKED TASK.

One blocked action must not stop unrelated work.

## Three-attempt rule
After three materially different legitimate attempts at the same failing operation, classify the failure and stop retrying that operation. Repair the underlying path if possible; otherwise checkpoint it and continue with another useful task. Repeated retries are not progress.

## Current project scope (owner directive 2026-11-03)
`interplanetarysister/interplanetary-fund2` is the authoritative product source and the target for migration away from Base44 to Cloudflare Workers/Pages + Supabase. The existing Base44 implementation remains the behavior reference and temporary rollback path until independent parity is verified; it is not the permanent target. Do not resume Vercel-specific or Convex-specific feature development. Adapt verified legacy behavior to the Cloudflare/Supabase architecture rather than copying obsolete infrastructure. Migration work must not simplify, omit, stub, or downgrade any existing feature or quality dimension.

## Source-of-truth rule
Never invent or assume runtime configuration, payment availability, deployment state, environment state, account state, or integration state. Trace data to an authoritative source. If authoritative information cannot be retrieved without unavailable paid/external resources, mark it unresolved rather than manufacturing a value.

## Safe completion
Do not trade correctness for activity. Never push knowingly broken code, weaken authentication/authorization, expose secrets, fabricate tests, mark unverified work complete, disable meaningful security checks just to pass a build, or remove required functionality merely because validation is inconvenient. Validate every completed change using the strongest zero-credit verification available.

## Stop conditions and checkpoint
Continue independent useful work while legitimate zero-credit work remains. Stop only when all executable zero-credit work is complete, continuing would be unsafe, required authorization/information is unavailable, or the remaining work genuinely requires unavailable paid/external resources.

Before stopping, record completed work, verification, remaining work, exact blockers, affected files/components, next executable action, and which remaining actions require credits.

## Primary directive
Do not spend credits merely to remain active. Build the project so useful work requires fewer credits. The goal is an increasingly self-checking, resumable, deterministic, low-resource development system—not an infinite agent loop.