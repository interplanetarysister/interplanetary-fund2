# Build & Builder Instructions — NO GUESSING

**Repository purpose: React/Vite frontend and product-integration surface for the single Interplanetary Fund platform.**

## NON-NEGOTIABLE

**NEVER GUESS.** Verify facts from the actual repository source, canonical backend source, deployed runtime, configuration, tests, or authoritative product records before making changes.

Do not infer architecture, ownership, dependencies, deployment targets, data sources, credentials, API contracts, feature status, or migration status from filenames, assumptions, memory fragments, or stale documentation.

If a request names a repository, branch, PR, environment, or feature and the exact target cannot be verified, mark it **UNKNOWN** and inspect before editing. Do not substitute another repository or branch silently.

## Evidence hierarchy

1. Explicit current Interplanetary Fund architecture/decision records.
2. Verified source, configuration, entities/functions, and tests in the exact repository and branch.
3. Verified canonical backend source (`interplanetary-fund-backend`) and API contracts.
4. Current deployed runtime state for the relevant environment.
5. Current build-agent instructions.
6. Historical documentation.
7. Never use unsupported inference as a fact.

If sources conflict, stop and reconcile the authoritative source. Do not silently choose one.

## Source-of-truth and deployment safety

- Treat React/Vite frontend code and Convex backend code as separate surfaces with explicit contracts.
- Before changing production behavior, reconcile the deployed Convex functions, cron topology, schema, and environment with the visible canonical backend source.
- Do not overwrite, delete, or replace deployed functionality that is absent from the visible source until its ownership and replacement path are verified.
- Static CI, Vercel status, or a successful repository build is not Development runtime proof or Production proof.
- Keep Development validation, Production evidence, and static verification clearly separated in commits and PR comments.

## Existing knowledge must be preserved

Do not repeatedly rediscover or overwrite established product knowledge. Treat the current capability registry, architecture decisions, repository purposes, and migration decisions as persistent state. If new evidence changes a decision, update the authoritative record.

## Before every build or change

1. Identify the exact repository, branch, PR, commit, and capability being changed.
2. Verify the current implementation and runtime behavior.
3. Determine whether the capability is canonical, compatibility-only, migration material, or production functionality.
4. Verify backend/data ownership, schema, API contracts, and cross-repository dependencies.
5. Check authentication, authorization, environment configuration, and deployment relationships.
6. For automation or financial workflows, inspect concurrency, idempotency, retry, duplicate-prevention, and recovery behavior before editing.
7. Only then implement.

## One-product rule

All repositories are components/surfaces of the **single cohesive Interplanetary Fund product**, not separate products. Campaigns, users, funds, communications, and other live business entities must use the canonical backend/data identity where the product architecture requires shared state.

Never create a competing production database or silently fork business logic.

## Migration rule

When functionality is being consolidated, preserve behavior and stable IDs, identify unique capabilities, and migrate them to the correct canonical destination. Do not delete or disable legacy functionality until production dependencies and equivalent canonical behavior are verified.

## Unknowns

If a fact cannot be verified, mark it **UNKNOWN**. Do not guess. Escalate only material decisions that cannot be resolved from available evidence.

## Completion and reporting rule

Never report a build, review, runtime validation, or production promotion as complete merely because the repository changed. Report only what is supported by exact commit/PR/runtime evidence. Clearly label work as **ACCOMPLISHED**, **TRUNCATED / INCOMPLETE**, or **AWAITING START** so Agent 3 can publish accurate progress reports without guessing.
