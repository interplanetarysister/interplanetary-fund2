# Interplanetary Fund — Application Repository

This repository contains a **React + Vite** application layer for the Interplanetary Fund product. It currently uses the Base44 SDK and Vite plugin for application integration.

This repository is **not** the authoritative Convex/backend source. The current backend contract identifies `interplanetarysister/interplanetary-fund-backend` as the authoritative backend and operations repository. The current `interplanetarysister/InterplanetaryFund` repository identifies itself as the authoritative user-facing frontend, so agents must reconcile the current migration/deployment contract before treating either application repository as the publishable frontend source.

## Before changing anything

**Never guess.** Read `AGENTS.md` and `docs/REPOSITORY_SOURCE_OF_TRUTH.md`, then inspect the exact current branch/PR, package configuration, caller, schema, and relevant backend contract.

Do not infer deployment state, provider configuration, credentials, runtime behavior, or source-of-truth ownership from old documentation or chat history.

## Build

Install dependencies:

```bash
npm install
```

Run the React/Vite development server:

```bash
npm run dev
```

Build the application:

```bash
npm run build
```

Run linting:

```bash
npm run lint
```

Run type checking:

```bash
npm run typecheck
```

Preview a production build:

```bash
npm run preview
```

Use the scripts that actually exist in the current `package.json`; do not invent commands or assume a hosting provider from the repository name.

## Application integration

The current source includes `@base44/sdk` and `@base44/vite-plugin`. Existing application integration paths should be inspected and reused before introducing another client, bridge, or backend path.

Base44 integration in this repository does **not by itself prove** that Base44 is the authoritative production database, deployment target, or backend. Verify those claims against the current deployment and backend contracts.

## Cross-repository work

Interplanetary Fund is one product across coordinated repositories. Backend business truth, security enforcement, treasury, payments, agent runtime, scheduled backend jobs, and operational state must remain in the authoritative backend where the current product contract assigns those responsibilities.

For cross-repository work:

1. identify the owning repository;
2. inspect both sides of the contract;
3. implement the smallest coherent change;
4. verify the boundary in controlled Development where required;
5. record exact SHAs and evidence in the PR.

Do not create a second production source of truth to work around an unverified contract.

## Review and release discipline

A successful local build or Git push is not a production release. Non-trivial work requires exact-head CI, applicable Development/runtime verification, Agent 2+3 review/audit, Agent 1 correction/verification, and final publication review according to the role-specific workflow.

Never reuse validation from a superseded PR head.

## Documentation

- `AGENTS.md` — mandatory build-agent rules and no-guessing policy.
- `docs/REPOSITORY_SOURCE_OF_TRUTH.md` — current repository boundary and evidence rules.

When repository ownership, deployment architecture, agent roles, or source-of-truth decisions materially change, update the affected documentation in the same reviewable change.
