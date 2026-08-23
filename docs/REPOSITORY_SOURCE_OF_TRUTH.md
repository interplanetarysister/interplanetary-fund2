# Interplanetary Fund — Repository Source-of-Truth Guide

**Effective:** 2026-08-23

This document tells application agents what belongs in this repository and where internal-agent/backend knowledge lives.

## Repository ownership

- **This repository (`interplanetarysister/interplanetary-fund2`)**: user-facing Base44 application, frontend, application entities/configuration, application-layer agents, onboarding, Mission Control, Agent Chat, and application-specific behavior.
- **`interplanetarysister/InterplanetaryFund`**: authoritative Convex backend and internal-agent runtime, including persistent agent identity, permissions, memory, outcomes, orchestration, scheduled intelligence, treasury/payments backend, and backend protocol.
- **`interplanetarysister/interplanetary-fund-backend`**: legacy/reference only unless explicitly assigned.

## Do not duplicate the internal agent knowledge base

The internal agent knowledge base is maintained in `InterplanetaryFund/interplanetary-fund-agent/`.

Application agents should reference the canonical material there when they need internal-agent context rather than copying it into this repository. The durable project decision archive is:
`InterplanetaryFund/docs/PROJECT_CONTEXT_ARCHIVE.md`

The internal-agent reference index is:
`InterplanetaryFund/docs/REFERENCE_MATERIAL_INDEX.md`

## Agent runtime boundary

Convex is authoritative for persistent agent identity, working/long-term memory, outcomes, permissions, and backend behavior. This application may display/mirror selected state and bridge user interactions to Convex, but it must not establish a competing production agent-memory or backend source of truth.

See `docs/AGENT_RUNTIME_UNIFICATION.md` for the current Base44↔Convex bridge and identity mapping.

## Role-specific workflow rule

The Convex Builder Agent workflow is **not a universal application-agent workflow**. Agents working on Convex/backend/agent-runtime implementation, review, verification, or publication must use:
`InterplanetaryFund/interplanetary-fund-agent/handoffs/CONVEX_BUILDER_AGENT_WORKFLOW.md`

Other agents follow their own role-specific instructions.

## Cross-repository changes

Never merge a change into a repository that does not own it. Cross-repository behavior must be implemented through an explicit interface, API, function, or bridge and verified at that boundary.

## Historical material

Historical feature reconciliations, recovered archives, audits, and legacy material are evidence/specification until verified against the current implementation. Do not recreate functionality solely because an old document mentions it.

## Continuity

When a decision materially changes application/backend boundaries, agent roles, workflow, or source-of-truth rules:
1. Update this document.
2. Update the canonical backend/agent document when applicable.
3. Update affected role-specific instructions/reference material.
4. Record the decision in the durable project archive.
