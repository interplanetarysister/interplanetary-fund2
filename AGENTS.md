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

## Node and npm runtime memory (verified 2026-09-18 UTC)

- Interplanetary Fund app `6a67a778342a8fe05ee79cba` supports Node **20.x and 22.x** and rejects Node 24. Preserve `package.json` and lockfile engine range `>=20 <23`. Keep `.nvmrc` and `.node-version` on Node 20 as the Base44/default baseline. CI must retain Node 20 coverage and may additionally verify Node 22 compatibility; do not restore a Node-22-only gate.
- Previously observed Base44 sandboxes have exposed both Node `20.20.2` and Node `22.23.2`; these are environment observations, not permanent package-version pins. Repository policy must remain compatible with managed Node 20 while accepting Node 22.
- Installation: official nodejs.org Linux x64 archive, verified against its SHA-256 manifest, extracted to `/opt/ifund-node22`; `/usr/local/bin/node`, `npm`, and `npx` link to its bin directory, ahead of `/usr/bin` on PATH.
- A fresh command shell confirmed Node 22.23.2 and npm 10.9.8. Typecheck, production build, and the Node 22 release-contract verifier passed after the change.
- Run app commands from `/app` (explicit `cd /app` was verified). Before installs/builds/typechecks after a new sandbox session, check `node --version`, `npm --version`, and `command -v node`; metadata alone does not select the running executable.
- The sandbox OS installation is not guaranteed to survive sandbox recreation. Available Base44 tools/documentation exposed no persistent sandbox-image Node selector. Do not claim this changes Base44's internal sync service or guarantees its hosted build runtime. Use the runtime supplied by the authorized Base44 environment when it is Node 20 or Node 22; do not force-upgrade a managed Node 20 sandbox.
- Repository commands accept executing Node 20 or Node 22 and fail closed on unsupported majors such as Node 24: `.npmrc` enables `engine-strict`, `scripts/require-node22.mjs` checks the actual process, and npm lifecycle hooks protect install/build/lint/typecheck and release tests. The release verifier requires a Node 20 Base44 compatibility check and accepts Node 20 or Node 22 execution. A Node-22-only workflow/version-file regression and unsupported majors such as Node 24 fail the contract.
- Base44 backend functions use their platform Deno runtime; the Node 20/22 rule concerns Node-based development/build tooling.

## Working Notes

- Do not trigger Base44 commands merely to test whether credits remain.
- Prefer deterministic/local verification that is confirmed not to consume metered project credits.
- Reuse existing SDK/client/plugin patterns before adding integration paths.
- Historical/reconstructed feature material is evidence, not automatic production truth.
- Run relevant confirmed zero-credit checks before finishing code changes.

## External integration truth boundary

- Saving provider credentials or an external profile is configuration only. It must leave the connection disconnected/unverified until a real provider-backed webhook, API read, or successful publish proves access.
- An admin acknowledgement or UI refresh must never manufacture `connected`, `verified`, or `last_synced` state. Provider evidence owns those fields.
- Owner-entered external fundraising totals are `owner_reported`, informational, currency-specific, and non-withdrawable. Never add different currencies into one displayed amount, and never credit them to the Interplanetary Fund ledger without a separate verified transfer.
- Every connection write tied to a campaign must validate campaign ownership server-side; client filtering is not an authorization boundary.
- Preserve these capability semantics if a future Convex/Vercel implementation returns: configuration, provider verification, external observation, and ledger credit remain distinct interfaces.

## Builder preservation rule

When correcting, extending, or improving existing work, edit the current implementation/artifact rather than recreating it from scratch. Preserve valid functionality, architecture, interfaces, and history where practical. Make the smallest coherent modification that satisfies the task.

A full rewrite is allowed only when the existing artifact cannot safely be edited or the task explicitly requires replacement. Document the reason, preserved behavior, and verification plan. This applies to code, configuration, schemas, documentation, agent definitions, workflows, prompts, generated assets, and other produced artifacts.

## Continuity rule

When a new decision changes repository ownership, agent roles, workflow, hosting scope, or application boundaries, update the affected durable repository instructions so stale guidance cannot silently override the newer decision. Runtime/version claims must be derived from the exact current `main` configuration and kept consistent across package metadata, lockfiles, version files, CI, and active PR handoffs; documentation alone cannot declare a new Node target.
