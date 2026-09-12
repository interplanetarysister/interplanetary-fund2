# AGENTS.md

## Project Context

This is the **authoritative user-facing Interplanetary Fund application implementation repository**, prepared for Base44 hosting.

### Current repository ownership

- **Application implementation target:** `interplanetarysister/interplanetary-fund2` — user-facing Base44 application, frontend, application entities/configuration, application-layer agents and workflows.
- **Older Vercel/Convex repositories and implementations:** reference/evidence only for recovering useful application behavior. Do not resume Vercel-specific or Convex-specific feature development and do not migrate obsolete hosting/runtime dependencies into this repository.
- **Legacy backend snapshots:** reference only unless the user explicitly changes scope.

### Cross-repository reliability incident boundary

- The production-reported Convex automation conflict incident remains a separately tracked cross-repository reliability workstream under Issue #310 and must not be silently dropped because this repository owns the Base44 application.
- This repository may document, inventory, and preserve evidence for the incident, but it is **not** the owning Convex implementation target unless an authoritative source/deployment mapping explicitly identifies it as such.
- Do not implement, deploy, or promote a Convex concurrency repair from this repository based only on production reports, stale snapshots, or inferred ownership. The owning backend repository/branch, Development deployment, schema/configuration identity, and executable Development validation must be established first.
- Once the owning repository is identified, keep changes there focused on safe serialization/claiming, idempotency, duplicate-run prevention, and bounded retry semantics; never treat increased retries or suppressed errors as the fix.

A PR must target the repository that owns the current change. Never merge a PR from one repository into another. Recover useful behavior by adapting it to the current application architecture, not by blindly copying infrastructure.

## Required first reads

Before substantial work, read:

1. `docs/ZERO_CREDIT_CONTINUOUS_WORK.md` — mandatory zero-credit/resumable work policy.
2. `docs/REPOSITORY_SOURCE_OF_TRUTH.md` — use current applicable ownership information; if it conflicts with the newer zero-credit/Base44-only directive, update it rather than following stale Vercel/Convex scope.
3. `docs/IF_FEATURE_RECONCILIATION_2026-08-21.md` — evidence-based feature baseline when feature work is involved; historical infrastructure statements are evidence, not current authority.
4. The current issue/PR, branch/head, existing handoffs, and recent findings.

Do not rely on old chat transcripts or stale archived infrastructure decisions when a newer repository directive supersedes them.

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

Use the existing Base44 application architecture in this repository. Do not add Vercel-specific dependencies such as `/_vercel/*`, and do not duplicate Convex runtime/backend implementation. Older implementations may be inspected as read-only evidence for application behavior that is still needed.

## Key Files

- `src/`: frontend application source.
- `src/api/base44Client.js`: frontend Base44 SDK client.
- `vite.config.js`: Vite config and Base44 Vite plugin setup.
- `base44/`: Base44 entities and application-layer agent/workflow definitions/configuration.
- `.env.local`: local-only environment values; never commit secrets.

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

When a new decision changes repository ownership, agent roles, workflow, hosting scope, or application boundaries, update the affected durable repository instructions so stale guidance cannot silently override the newer decision.
