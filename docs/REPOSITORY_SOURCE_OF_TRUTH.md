# Interplanetary Fund — Repository Source-of-Truth Guide

**Effective:** 2026-09-09

## Current ownership

`interplanetarysister/interplanetary-fund2` (ifund2) is the authoritative implementation target for the complete currently active Interplanetary Fund application on Base44: React/Vite frontend, Base44 entities, Base44 backend functions, application agents, workflows, financial integrity, campaign/user behavior, integrations, Mission Control and operational state required by the application.

Older Convex, Vercel, legacy backend, preview and duplicate repositories are read-only evidence/migration sources. They are not required runtime dependencies for the current Base44 build. Convex/Vercel may be reconsidered as a later infrastructure phase only when the owner explicitly reactivates that work.

## Runtime independence rule

Current Base44 functionality must not require a Convex or Vercel runtime merely because an older implementation did. Recover the useful behavior and contracts, then implement them with Base44-native entities/functions where safe. Do not copy obsolete hosting dependencies, secrets, deployment assumptions, `/_vercel/*` paths, or a second backend wholesale.

Existing compatibility names may remain temporarily when renaming them would create unnecessary breakage, but their implementation must not silently call retired infrastructure. Document compatibility shims so future builders do not recreate duplicate features.

## Evidence and consolidation policy

Before changing a feature:
1. Verify current ifund2 implementation and Base44 schema/function behavior.
2. Inspect older repositories only for missing behavior or contracts.
3. Classify the difference as already consolidated, migration candidate, historical-only, deferred, or UNKNOWN.
4. Adapt only verified useful behavior into the existing Base44 implementation.
5. Preserve stable IDs, financial idempotency, authorization, auditability and provider truth.
6. Never infer payment/provider availability from UI labels or source presence.
7. Verify with deterministic zero-credit checks wherever possible; paid publish/runtime verification remains a separate gate when credits are unavailable.
8. Record completed migrations here or in the migration ledger before another builder starts equivalent work.

## Financial source of truth

For the current Base44-only phase, Base44 server-side financial entities/functions are the application financial authority. Client/UI values are never authoritative. Provider-confirmed payment evidence is required before funds become confirmed/withdrawable. `FinancialOperation` provides the Base44-native idempotent operation ledger for donations, external observations and withdrawal reservations/completions. Donation mirrors and campaign totals derive from verified server operations; external observations do not become withdrawable merely because they were observed.

## Agent runtime

Base44 agents and Base44 entities/functions are the active agent runtime for this phase. Agent interactions are persisted in Base44 `AgentActivity`; the compatibility `recordAgentInteraction` endpoint no longer requires Convex. The compatibility `syncFromConvex` endpoint now refreshes Base44-native Ops Center state and does not contact Convex. The former scheduled Convex Sync workflow is removed to avoid obsolete runtime dependency and unnecessary metered executions.

## Cross-repository rule

Do not implement the same active feature in multiple repositories. Once a legacy Convex/Vercel behavior has been reconciled into this Base44 branch, update the migration record so other agents treat the old implementation as evidence rather than a parallel target. Do not archive/delete source repositories until dependency removal and feature equivalence are independently verified.

## Completion rule

A Git commit is not proof of Base44 runtime success. A change is complete only after the strongest available deterministic checks pass and, when required, Base44 runtime/publish verification succeeds. If runtime verification would consume unavailable credits, record that exact remaining gate rather than claiming it ran.
