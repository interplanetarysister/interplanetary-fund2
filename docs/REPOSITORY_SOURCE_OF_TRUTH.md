# Interplanetary Fund — Repository Source-of-Truth Guide

**Effective:** 2026-09-08

This document tells application agents what belongs in this repository and where internal-agent/backend knowledge lives.

## Repository ownership

- **This repository (`interplanetarysister/interplanetary-fund2`, aka ifund2)**: authoritative consolidation destination for the user-facing Interplanetary Fund Base44 / React+Vite application, frontend, application entities/configuration, application-layer functions/agents, onboarding, Mission Control, Agent Chat, campaign/user UX, integrations presented to users, and application-specific behavior.
- **`interplanetarysister/InterplanetaryFund`**: historical/reference implementation of backend and internal-agent behavior. Convex/Vercel-specific work is stopped; do not treat this repository as a current implementation or deployment target.
- **`interplanetarysister/interplanetary-fund-backend`**: legacy/reference only unless explicitly reassigned by the owner; do not add new production backend architecture there by default.
- Other historical, Vercel-only, duplicate, preview, or migration repositories are not alternate application targets. Treat them as evidence/migration sources unless explicitly reassigned.

The current owner-authorized Base44-only directive in `AGENTS.md` and `docs/ZERO_CREDIT_CONTINUOUS_WORK.md` supersedes older infrastructure contracts, including those repeated in open issues and PRs. This is an implementation direction, not evidence that existing runtime dependencies have already been removed or that a production migration succeeded.

## Consolidation policy

All pending or newly discovered **application-owned** updates that have not reached ifund2 must be reconciled into this repository rather than continuing parallel implementation elsewhere.

For every candidate update:
1. Verify the source behavior/data; never infer from labels, filenames, stale docs, or repository names.
2. Verify the current ifund2 implementation first.
3. Classify the difference as already consolidated, application migration candidate, unresolved runtime dependency, historical-only, or UNKNOWN.
4. Merge only verified application-owned behavior into the existing ifund2 implementation, preserving stable IDs/interfaces and valid current behavior.
5. Reuse existing Base44 application functions and entities. Do not copy Convex runtime code or introduce Vercel dependencies. Record still-required legacy dependencies as unresolved until a verified Base44 replacement exists.
6. Verify authentication, authorization, payment/provider configuration, data ownership, and end-to-end runtime behavior before declaring consolidation complete.
7. Do not delete/archive a source implementation until equivalence and dependency removal are verified.

A Git commit is not runtime proof. Provider/feature status shown in the UI must come from verified capability/configuration/runtime evidence. This specifically applies to payment methods such as PayPal and Stripe: a stale frontend status must never override a verified working payment path.

## Issue #1 reconciliation

The original Issue #1 request to “bring all backend features repository improvements to this repo” predates this ownership model. Its safe current interpretation is:

- recover useful application behavior through existing Base44 functions/entities;
- implement application-facing behavior here;
- treat `InterplanetaryFund` runtime code as read-only evidence;
- compare legacy backend capabilities before migrating them;
- never copy a backend merely to satisfy the historical wording or create a second source of truth.

See `docs/ISSUE_1_BACKEND_FEATURE_RECONCILIATION.md` for the durable completion record.

## Do not duplicate the internal agent knowledge base

The historical internal agent knowledge base is preserved in `InterplanetaryFund/interplanetary-fund-agent/`.

Application agents may reference that material for historical context rather than copying it into this repository. Its older hosting/runtime directives do not override the current Base44-only scope. The durable project decision archive is:
`InterplanetaryFund/docs/PROJECT_CONTEXT_ARCHIVE.md`

The internal-agent reference index is:
`InterplanetaryFund/docs/REFERENCE_MATERIAL_INDEX.md`

## Agent runtime boundary

Base44 is the authorized application implementation target. Existing Convex bridges in source are unresolved legacy dependencies, not permission to resume Convex work. Preserve dependent working behavior until replacement and equivalence are verified; do not delete a bridge merely to make the repository appear migrated.

See `docs/AGENT_RUNTIME_UNIFICATION.md` for historical Base44↔Convex bridge and identity mapping evidence. Actual deployment state is UNKNOWN / REQUIRES VERIFICATION unless separately established.

## Role-specific workflow rule

The historical Convex Builder Agent workflow does not authorize active work under the current scope. Review useful application requirements, preserve unrelated valid work, and mark Convex/Vercel implementation and deployment portions superseded. Outstanding financial authorization, concurrency, and recovery requirements still need Base44-compatible proof; scope correction does not close those requirements.

Other agents follow their role-specific instructions. All builders/reviewers/verifiers must follow the no-assumptions evidence rule for every action.

## Cross-repository changes

Never merge a change into a repository that does not own it. Cross-repository behavior must be implemented through an explicit interface, API, function, or bridge and verified at that boundary.

## Historical material

Historical feature reconciliations, recovered archives, audits, migration manifests, and legacy material are evidence/specification until verified against the current implementation. Do not recreate functionality solely because an old document mentions it, and do not execute historical shutdown/decommission instructions as if they were current approval.

## Continuity

When a decision materially changes application/backend boundaries, agent roles, workflow, or source-of-truth rules:
1. Update this document.
2. Update the canonical backend/agent document when applicable.
3. Update affected role-specific instructions/reference material.
4. Record the decision in the durable project archive.
