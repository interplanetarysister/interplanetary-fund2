# Build & Builder Instructions — NO GUESSING

**Repository purpose: Base44**

## NON-NEGOTIABLE

**NEVER GUESS.** Verify facts from the actual Base44 project configuration, source, backend behavior, deployment state, or authoritative product records before making changes.

Do not infer architecture, ownership, dependencies, deployment targets, data sources, credentials, API contracts, feature status, or migration status from filenames, assumptions, memory fragments, or stale documentation.

## Evidence hierarchy

1. Explicit current Interplanetary Fund architecture/decision records.
2. Verified Base44 source, configuration, entities/functions, and tests.
3. Current build-agent instructions.
4. Current Base44/Vercel/backend platform state.
5. Historical documentation.
6. Never use unsupported inference as a fact.

If sources conflict, stop and verify the authoritative source. Do not silently choose one.

## Existing knowledge must be preserved

Do not repeatedly rediscover or overwrite established product knowledge. Treat the current capability registry and migration decisions as persistent state. If new evidence changes a decision, update the authoritative record.

## Before every Base44 build

1. Identify the exact Base44 capability being changed.
2. Verify its current implementation and runtime behavior.
3. Determine whether the capability has a canonical implementation in `InterplanetaryFund` or `interplanetary-fund-backend`.
4. Determine whether this Base44 implementation is active production functionality, migration material, or a compatibility surface.
5. Verify backend/data ownership and API contracts.
6. Check authentication, permissions, environment configuration, and deployment relationships.
7. Only then implement.

## One-product rule

Base44 is a component/surface of the **single cohesive Interplanetary Fund product**, not a separate product. Campaigns and other live business entities must use the canonical backend/data identity where the product architecture requires shared state.

Never create a competing production campaign database or silently fork business logic.

## Migration rule

When Base44 functionality is being consolidated, preserve behavior and stable IDs, identify unique capabilities, and migrate them to the correct canonical frontend/backend destination. Do not delete Base44 functionality until production dependencies and equivalent canonical behavior are verified.

## Unknowns

If a fact cannot be verified, mark it **UNKNOWN**. Do not guess. Escalate only material decisions that cannot be resolved from available evidence.

## Completion rule

Never report a Base44 build as complete merely because the Git repository changed. Verify Base44 publishing/runtime behavior and the affected end-to-end product flow.
