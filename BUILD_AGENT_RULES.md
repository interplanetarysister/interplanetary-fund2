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

Base44/ifund2 is the authoritative application target. Legacy Convex/Vercel implementations are evidence or migration sources only unless the owner explicitly reassigns them. Do not create new user-facing dependencies on retired runtime architecture, and do not expose retired provider/runtime names to users.

When a requested change spans application and supporting services, verify the current owning implementation before editing. Never duplicate state or business logic merely to make consolidation appear complete.

## Before every Base44 build

1. Identify the exact Base44 capability being changed.
2. Verify its current implementation and runtime behavior in ifund2.
3. Search other Interplanetary Fund repositories only for missing/newer behavior or evidence that has not yet reached ifund2.
4. Classify each discovered difference as: already consolidated, application migration candidate, backend-owned dependency, historical-only, or UNKNOWN.
5. For an application migration candidate, edit the existing ifund2 implementation rather than replacing it, preserving stable IDs, valid behavior, and interfaces.
6. Verify backend/data ownership and API contracts.
7. Check authentication, permissions, environment configuration, and deployment relationships.
8. Only then implement.

## Human-first prosperity rule

Humans are the purpose of Interplanetary Fund. Users and admins must never be expected to understand internal software architecture in order to use the product successfully.

Every visible word, control, button, field, menu, dialog, state, and workflow must remain readable and understandable before interaction, during hover/focus/selection, while text is being entered, after entry, when disabled/read-only, and in both supported appearance modes. Audit contrast color-by-color and state-by-state; repair noncompliance where it is found rather than masking it with explanatory text.

Every installed function, agent, workflow, page, and subsystem must have a verified purpose that advances safe, lawful Interplanetary Fund success: helping people raise, receive, manage, share, understand, or administer funds and campaigns; improving trust, reliability, reach, accessibility, efficiency, or financial sustainability; or providing necessary platform/security operations. Internal complexity without a current purpose must be consolidated, retired, or kept only as an explicit compatibility tombstone when removal would be unsafe.

Do not promote external platforms for their own sake. Platform-specific architecture, success patterns, and campaign-fit intelligence belong to specialist agents/internal routing unless the human specifically asks for that information.

## Validation batching rule

Do not run long production builds, runtime suites, or full validation after every small repository edit. Perform targeted source checks while repairing, accumulate coherent changes, and run full verification at meaningful checkpoints or before publish/release. A repository touch alone is not a reason to consume build/runtime resources.

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
