# Interplanetary Fund — Repository Source-of-Truth Guide

**Effective:** 2026-11-03 (supersedes prior Base44-hosted ownership direction)

This document identifies the application source repository and the independent production target. Owner directive dated 2026-11-03 supersedes earlier statements that Base44 is the permanent application runtime.

## Repository ownership

- **This repository (`interplanetarysister/interplanetary-fund2`, aka ifund2)**: authoritative source for the user-facing Interplanetary Fund product, React/Vite frontend, entities/configuration, application functions, agent/workflow definitions, onboarding, Mission Control, Agent Chat, campaigns, user UX, integrations, and application behavior. It is being migrated to Cloudflare Workers/Pages and Supabase.
- **`interplanetarysister/InterplanetaryFund`**: historical/reference source for Convex-era backend and internal-agent behavior. Reuse verified product behavior when needed, but do not blindly restore legacy infrastructure.
- **`interplanetarysister/interplanetary-fund-backend`**: legacy/reference only unless explicitly reassigned by the owner; do not add new production backend architecture there by default.
- Other historical, Vercel-only, duplicate, preview, or migration repositories are not alternate application targets. Treat them as evidence/migration sources unless explicitly reassigned.

This September 6, 2026 owner-authorized boundary supersedes historical documents that describe a different application consolidation direction.

## Consolidation policy

All pending or newly discovered **application-owned** updates must be reconciled into this repository. Independent runtime implementation belongs in this repository's Cloudflare/Supabase architecture.

For every candidate update:
1. Verify the source behavior/data; never infer from labels, filenames, stale docs, or repository names.
2. Verify the current ifund2 implementation first.
3. Classify the difference as already consolidated, application migration candidate, backend-owned dependency, historical-only, or UNKNOWN.
4. Merge only verified application-owned behavior into the existing ifund2 implementation, preserving stable IDs/interfaces and valid current behavior.
5. Preserve current production behavior as the reference while implementing the independent Cloudflare/Supabase destination; do not recreate legacy bridges by assumption.
6. Verify authentication, authorization, payment/provider configuration, data ownership, and end-to-end runtime behavior before declaring consolidation complete.
7. Do not delete/archive a source implementation until equivalence and dependency removal are verified.

A Git commit is not runtime proof. Provider/feature status shown in the UI must come from verified capability/configuration/runtime evidence. This specifically applies to payment methods such as PayPal and Stripe: a stale frontend status must never override a verified working payment path.

## Issue #1 reconciliation

The original Issue #1 request to “bring all backend features repository improvements to this repo” predates this ownership model. Its safe current interpretation is:

- expose relevant backend capabilities in this application through explicit functions/APIs/bridges;
- implement application-facing behavior here;
- treat legacy backend/runtime implementation in `InterplanetaryFund` as evidence unless a live dependency is verified;
- compare legacy backend capabilities before migrating them;
- never copy a backend merely to satisfy the historical wording or create a second source of truth.

See `docs/ISSUE_1_BACKEND_FEATURE_RECONCILIATION.md` for the durable completion record.

## Do not duplicate the internal agent knowledge base

The internal agent knowledge base is maintained in `InterplanetaryFund/interplanetary-fund-agent/`.

Application agents should reference the canonical material there when they need internal-agent context rather than copying it into this repository. The durable project decision archive is:
`InterplanetaryFund/docs/PROJECT_CONTEXT_ARCHIVE.md`

The internal-agent reference index is:
`InterplanetaryFund/docs/REFERENCE_MATERIAL_INDEX.md`

## Agent runtime boundary

The existing Base44 agent runtime is the current behavior reference during migration, not the target runtime. The independent workforce must reproduce identity, scoped memory, permissions, outcomes, tools, delegation, and audit behavior before cutover. Do not restore a Convex agent-memory/runtime bridge without direct owner direction.

See `docs/AGENT_RUNTIME_UNIFICATION.md` for the current Base44 agent-runtime model and historical bridge context; any Convex bridge described there is non-authoritative unless directly verified as live.

## Role-specific workflow rule

The Convex Builder Agent workflow is not a universal application-agent workflow. Agents working on Convex/backend/agent-runtime implementation, review, verification, or publication must use the canonical backend workflow in `InterplanetaryFund/interplanetary-fund-agent/handoffs/CONVEX_BUILDER_AGENT_WORKFLOW.md` when applicable.

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
