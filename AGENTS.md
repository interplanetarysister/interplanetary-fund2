# AGENTS.md

## Project Context

This is the **authoritative user-facing Interplanetary Fund application implementation repository**, prepared for Base44 hosting.

### Current repository ownership

- **Application implementation target:** `interplanetarysister/interplanetary-fund2` — user-facing Base44 application, frontend, application entities/configuration, application-layer agents and workflows.
- **Existing backend/runtime authority:** `InterplanetaryFund` remains the authoritative Convex backend/runtime for already-deployed payment, deduplication, agent-memory, and related bridges until an explicitly reviewed replacement is verified. Treat it as current backend ownership/evidence, not as disposable historical code.
- **Older Vercel/Convex repositories and implementations:** reference/evidence only for recovering useful application behavior when they are not the current owner. Do not copy obsolete hosting/runtime dependencies or create competing state in Base44.
- **Legacy backend snapshots:** reference only unless the user explicitly changes scope.

A PR must target the repository that owns the current change. Never merge a PR from one repository into another. Recover useful behavior by adapting it to the current application architecture, not by blindly copying infrastructure.

## Required first reads

Before substantial work, read:

1. `docs/ZERO_CREDIT_CONTINUOUS_WORK.md` — mandatory zero-credit/resumable work policy.
2. `docs/REPOSITORY_SOURCE_OF_TRUTH.md` — use current applicable ownership information; preserve the authoritative Convex backend boundary unless a newer reviewed decision explicitly changes it.
3. `docs/IF_FEATURE_RECONCILIATION_2026-08-21.md` — evidence-based feature baseline when feature work is involved; historical infrastructure statements are evidence, not automatic permission to duplicate runtime.
4. The current issue/PR, branch/head, existing handoffs, and recent findings.

Do not rely on old chat transcripts or stale archived infrastructure decisions when a newer repository directive supersedes them, but do not silently override an existing backend/runtime owner with a documentation-only Base44 rule.

## Mandatory zero-credit development rule

All development/build/review agents, Codex/Copilot-style agents, Agent 1/2/3, and development workflows must follow `docs/ZERO_CREDIT_CONTINUOUS_WORK.md`.

While the zero-credit constraint is active:
- do not initiate metered Base44 builder, agent, workflow, API, deployment, or other paid operations;
- do not bypass quotas, billing controls, or rate limits;
- do not create recursive self-triggering loops to evade provider limits;
- use confirmed legitimate zero-credit repository/local/deterministic paths wherever possible;
- checkpoint genuinely blocked paid steps and continue independent useful work;
- after three materially different failed attempts at one operation, stop retrying it, repair the path or record the blocker, and continue elsewhere;
- persist enough state that later work resumes instead of restarting.

The goal is a self-checking, resumable, deterministic, low-resource development system, not endless agent execution.

## Data source rule

Never assume runtime configuration, payment availability, deployment state, environment state, account state, or integration state. Trace information to its authoritative source. If authoritative data is unavailable, record it as unresolved rather than inventing a value.

## Base44 application boundary

Use the existing Base44 application architecture in this repository for product work that it owns. Do not add Vercel-specific dependencies such as `/_vercel/*`, and do not duplicate Convex runtime/backend implementation. Preserve existing Convex-owned payment, deduplication, and agent-memory bridges until a reviewed migration replaces them. Older implementations may be inspected as read-only evidence for application behavior that is still needed.

## Key Files

- `src/`: frontend application source.
- `src/api/base44Client.js`: frontend Base44 SDK client.
- `vite.config.js`: Vite config and Base44 Vite plugin setup.
- `base44/`: Base44 entities and application-layer agent/workflow definitions/configuration.

## Working Notes

- Do not trigger Base44 commands merely to test whether credits remain.
- Prefer deterministic/local verification that is confirmed not to consume metered project credits.
- Reuse existing SDK/client/plugin patterns before adding integration paths.
- Historical/reconstructed feature material is evidence, not automatic production truth.
- Run relevant confirmed zero-credit checks before finishing code changes.

## Builder preservation rule

When correcting, extending, or improving existing work, edit the current implementation/artifact rather than recreating it from scratch. Preserve valid functionality, architecture, interfaces, and history where practical. Make the smallest coherent modification that satisfies the task.

A full rewrite is allowed only when the existing artifact cannot safely be edited or the task explicitly requires replacement. Document the reason, preserved behavior, and verification plan. This applies to code, configuration, schemas, documentation, agent definitions, workflows, prompts, generated assets, and other produced artifacts.

## Continuity rule

When a new decision changes repository ownership, agent roles, workflow, hosting scope, or application boundaries, update the affected durable repository instructions so stale guidance cannot silently override the newer decision. Runtime/version claims must be derived from the exact current `main` configuration and kept consistent across package metadata, lockfiles, version files, CI, and active PR handoffs; documentation alone cannot declare a new Node target.
