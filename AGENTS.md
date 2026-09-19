# AGENTS.md

## Project Context

This is the **authoritative user-facing Interplanetary Fund application implementation repository**, prepared for Base44 hosting.

### Current repository ownership

- **Application implementation target:** `interplanetarysister/interplanetary-fund2` — user-facing Base44 application, frontend, application entities/configuration, application-layer agents and workflows.
- **Older Vercel/Convex repositories and implementations:** reference/evidence only for recovering useful application behavior. Do not resume Vercel-specific or Convex-specific feature development and do not migrate obsolete hosting/runtime dependencies into this repository.
- **Legacy backend snapshots:** reference only unless the user explicitly changes scope.

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

## Node and npm runtime memory (verified 2026-09-18 UTC)

- Interplanetary Fund app `6a67a778342a8fe05ee79cba` targets Node **22.x**, not Node 24. Preserve `package.json` engines.node `22.x`, lockfile root engine `22.x`, `.nvmrc` and `.node-version` `22`, and Node 22 GitHub workflow pins.
- The active Base44 sandbox was updated from Node `20.20.2` to **22.23.2**, with **npm 10.9.8** bundled with that official Node distribution. These exact patch versions are verified environment observations, not a new permanent package-version pin.
- Installation: official nodejs.org Linux x64 archive, verified against its SHA-256 manifest, extracted to `/opt/ifund-node22`; `/usr/local/bin/node`, `npm`, and `npx` link to its bin directory, ahead of `/usr/bin` on PATH.
- A fresh command shell confirmed Node 22.23.2 and npm 10.9.8. Typecheck, production build, and the Node 22 release-contract verifier passed after the change.
- Run app commands from `/app` (explicit `cd /app` was verified). Before installs/builds/typechecks after a new sandbox session, check `node --version`, `npm --version`, and `command -v node`; metadata alone does not select the running executable.
- The sandbox OS installation is not guaranteed to survive sandbox recreation. Available Base44 tools/documentation exposed no persistent sandbox-image Node selector. Do not claim this changes Base44's internal sync service or guarantees its hosted build runtime. Re-establish Node 22 through an authorized supported path if the sandbox resets.
- Repository commands fail closed when the executing runtime is not Node 22: `.npmrc` enables `engine-strict`, `scripts/require-node22.mjs` checks the actual process and executable, npm lifecycle hooks protect install/build/lint/typecheck and release tests, and the release-contract verifier independently checks its executing Node process. The verifier parses the complete workflow inventory as YAML and requires every `actions/setup-node` step to use a literal `22` or `22.x`; missing, malformed, stray, dynamic/matrix, and incompatible declarations fail the contract. A Node 20 rejection is intentional and must not be bypassed.
- Base44 backend functions use their platform Deno runtime; this Node 22 rule concerns Node-based development/build tooling.

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

When a new decision changes repository ownership, agent roles, workflow, hosting scope, or application boundaries, update the affected durable repository instructions so stale guidance cannot silently override the newer decision.