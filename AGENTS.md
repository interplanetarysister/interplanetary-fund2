# AGENTS.md

## Project Context

This repository contains a **React + Vite user-facing application** that currently uses the Base44 SDK/Vite plugin. It is part of the single Interplanetary Fund product; it is not a separate product.

### Current repository boundary

- **`interplanetarysister/interplanetary-fund2`** — application-layer React/Vite source currently visible in this repository, including user-facing screens, application integrations, Base44-backed entities/configuration, and application-specific workflows.
- **`interplanetarysister/interplanetary-fund-backend`** — authoritative backend/operations repository according to its current `README.md`: Convex functions, canonical business state, admin/agent runtime, security, treasury, payments, scheduled jobs, and operational integrations.
- **`interplanetarysister/InterplanetaryFund`** — current authoritative frontend repository according to its current `README.md`; reconcile any cross-repository migration/ownership claim against the current repository contracts before changing it.
- **`interplanetarysister/interplanetary-fund`** — migration/reference repository; do not treat historical code as production truth without current-source verification.

These repository roles must be established from the current repository documents and source before implementation. If two repositories disagree, stop and reconcile the discrepancy; do not guess.

## Mandatory no-guessing rule

**Never guess.** Every build agent, reviewer, auditor, Copilot/Codex task, and human implementation must establish the current source of truth before modifying behavior.

Before substantial work:

1. Read this file and `docs/REPOSITORY_SOURCE_OF_TRUTH.md`.
2. Read the current issue/PR, exact base/head SHA, existing review/audit comments, and relevant package/build configuration.
3. Identify which repository owns the capability and whether the change is frontend-only, backend-only, or cross-repository.
4. Inspect the actual current caller, schema, workflow, and integration before designing a replacement.
5. If required information is absent, mark it **UNKNOWN / REQUIRES VERIFICATION** and gather evidence from the owning repository or controlled environment. Do not infer it from names, stale documentation, old PRs, generated artifacts, or chat history.
6. Never claim a feature, deployment, runtime result, provider configuration, review, approval, or production state that was not directly verified.

### Evidence precedence

Use evidence in this order unless a newer authoritative decision explicitly supersedes it:

1. Actual controlled runtime/deployment state and authoritative backend behavior.
2. Current source on the repository/branch that owns the capability.
3. Current schema/configuration and executable tests/workflows.
4. Current issue/PR acceptance criteria and review findings.
5. Historical documentation or reconstructed feature material.
6. Chat recollection.

Historical material is evidence/specification, not automatic production truth.

## Required workflow for every build

For every non-trivial change:

1. **Assess** — inspect the exact current implementation and dependencies.
2. **Plan** — define the smallest coherent change and explicitly list unknowns.
3. **Review** — obtain the required Agent 2+3 review/audit against the exact head before implementation when the task requires plan review.
4. **Implement** — edit the existing implementation where safe; do not recreate functionality unnecessarily.
5. **Verify** — run relevant tests, lint/typecheck/build, and controlled Development/runtime checks where required.
6. **Handoff** — record exact base/head SHAs, files changed, tests/results, unresolved findings, and whether work is ACCOMPLISHED, INCOMPLETE, or AWAITING START.
7. **Publish** — only after the complete 1→2+3→1→3 workflow and all applicable production gates pass.

Never merge a draft, never treat static CI as runtime proof, and never reuse evidence from a superseded SHA.

## Application/backend source-of-truth boundary

The backend must remain authoritative for persistent business state and security-sensitive behavior where the current product contract assigns it authority. This application may display or bridge backend state, but must not create a competing production source of truth for users, campaigns, donations, permissions, agent state, treasury, payments, or other authoritative business records.

For cross-repository changes, identify the authoritative backend contract first and verify both sides of the boundary. Never silently duplicate business logic to compensate for an unverified backend contract.

## Build-agent preservation rule

When correcting or extending an existing artifact, edit the actual current implementation and preserve valid behavior, interfaces, architecture, and history where practical. A rewrite/replacement is allowed only when the existing artifact cannot safely be edited or the task explicitly requires replacement. Document why, what valid behavior is preserved, and how equivalence/regression is verified.

This rule applies to code, configuration, schemas, documentation, agent definitions, workflows, prompts, and generated artifacts.

## Dependency and integration safety

- Do not add a new integration when an existing authoritative path already provides the capability until the existing path has been inspected.
- Do not add a second source of truth for data already owned elsewhere.
- Do not invent provider credentials, endpoints, OAuth behavior, payment states, deployment configuration, or runtime capabilities.
- Treat `setup_required`, `coming_soon`, unsupported, connected, and operational states as distinct; only mark a capability connected when the authoritative connection state proves it.
- For payment or financial behavior, require server/provider verification and idempotency/recovery evidence; client-side success is not proof of settlement.
- For AI behavior, treat user-controlled content as untrusted input and preserve recommendation/approval boundaries.
- For scheduled automation, inspect every shared write target and execution path before changing retries or concurrency behavior.

## Exact-head rule

Validation belongs to the code eligible for publication. Record and verify the exact PR head SHA for every meaningful CI, runtime, audit, and publication result. If the head changes, previous evidence is superseded unless independently rerun against the new head.

## Convex/backend work

When this repository changes behavior that depends on Convex or the authoritative backend:

- Reconcile the deployed backend/runtime with the visible source before changing production behavior.
- Do not delete or overwrite deployed functionality merely because it is absent from this repository.
- For concurrency defects, identify the actual conflicting records/functions first; use serialization/claiming, idempotency, duplicate-run prevention, and recovery semantics rather than merely increasing retries.
- Development is the controlled validation target when production behavior is involved.
- Production promotion requires exact-head Development evidence plus the complete Agent 1→Agent 2+3→Agent 1→Agent 3 workflow.

## Repository documentation

When a build-agent instruction or repository boundary changes, update the affected source-of-truth documentation in the same reviewable change. Never leave contradictory instructions in `README.md`, `AGENTS.md`, or `docs/`.
