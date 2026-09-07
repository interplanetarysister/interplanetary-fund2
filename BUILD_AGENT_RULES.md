# Build & Builder Instructions — NO GUESSING

**Repository purpose: authoritative Interplanetary Fund user-facing Base44 application and consolidation target (`interplanetary-fund2` / ifund2).**

## NON-NEGOTIABLE

**NEVER GUESS.** Verify facts from the actual Base44 project configuration, source, backend behavior, deployment state, or authoritative product records before making changes.

Do not infer architecture, ownership, dependencies, deployment targets, data sources, credentials, API contracts, feature status, or migration status from filenames, assumptions, memory fragments, or stale documentation.

## Evidence hierarchy

1. Explicit current Interplanetary Fund architecture/decision records.
2. Verified Base44 source, configuration, entities/functions, and tests.
3. Current build-agent instructions.
4. Current Base44/backend platform state.
5. Historical documentation.
6. Never use unsupported inference as a fact.

If sources conflict, stop and verify the authoritative source. Do not silently choose one.

## Existing knowledge must be preserved

Do not repeatedly rediscover or overwrite established product knowledge. Treat the current capability registry and migration decisions as persistent state. If new evidence changes a decision, update the authoritative record.

## Authoritative application consolidation rule

`interplanetary-fund2` is the authoritative destination for all user-facing Interplanetary Fund application implementation and updates: Base44/React UI, application entities/configuration, application-layer functions, application agents/workflows, campaign/user UX, and integration surfaces.

Do not implement new user-facing application work in Vercel-only, legacy, duplicate, or historical repositories. Those repositories are evidence/migration sources only unless the owner explicitly reassigns ownership.

This rule does **not** move authoritative Convex/backend runtime ownership into this repository. Backend/runtime work remains in `InterplanetaryFund` and must be consumed here through explicit verified interfaces/bridges.

When a requested change spans application and backend, place each portion in its owning repository and verify the boundary. Never duplicate backend state or business logic merely to make consolidation appear complete.

## Before every Base44 build

1. Identify the exact Base44 capability being changed.
2. Verify its current implementation and runtime behavior in ifund2.
3. Search other Interplanetary Fund repositories only for missing/newer behavior or evidence that has not yet reached ifund2.
4. Classify each discovered difference as: already consolidated, application migration candidate, backend-owned dependency, historical-only, or UNKNOWN.
5. For an application migration candidate, edit the existing ifund2 implementation rather than replacing it, preserving stable IDs, valid behavior, and interfaces.
6. Verify backend/data ownership and API contracts.
7. Check authentication, permissions, environment configuration, and deployment relationships.
8. Only then implement.

## One-product rule

Base44 is a component/surface of the **single cohesive Interplanetary Fund product**, not a separate product. Campaigns and other live business entities must use the canonical backend/data identity where the product architecture requires shared state.

Never create a competing production campaign database or silently fork business logic.

## Migration rule

When functionality is being consolidated into ifund2, preserve behavior and stable IDs, identify unique capabilities, and migrate application-owned behavior into the existing canonical implementation. Do not delete or archive a source implementation until production dependencies and equivalent canonical behavior are verified.

Never treat repository presence, a stale UI label, configuration text, or a successful Git commit as proof that a provider or feature is live. Payment/provider availability must be derived from verified runtime/provider capability data. In particular, PayPal/Stripe UI status must reflect actual configured and working payment paths, not assumptions based on frontend labels.

## Unknowns

If a fact cannot be verified, mark it **UNKNOWN**. Do not guess. Escalate only material decisions that cannot be resolved from available evidence.

## Completion rule

Never report a Base44 build as complete merely because the Git repository changed. Verify Base44 publishing/runtime behavior and the affected end-to-end product flow.
