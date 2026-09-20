# Application Runtime Baseline Reconciliation — 2026-09-20

## Exact source baseline
- Repository: `interplanetarysister/interplanetary-fund2`
- Base branch: `main`
- Base SHA: `ae1baa27d7521a14c76857569c2a63cacc3f9a54`
- Discovery commit: `2fa44f09c5e5a64a90a57b4d6ae2e1dc79de7634`

## Finding
The current application metadata was changed toward Node 20 compatibility while the established release-integrity evidence standard and active PR handoffs require exact-head Node 22 locked validation. A successful Node 20 run must not be treated as sufficient publication evidence.

## Bounded implementation
This PR adds `scripts/verify-runtime-baseline-reconciliation.mjs`, which fails closed when:
- `package.json` does not explicitly include Node 22 in `engines.node`;
- `.nvmrc` or `.node-version` exists but selects a non-22 runtime;
- a workflow uses `setup-node` without declaring Node 22.

This is an evidence/guard slice only. It does not choose or mutate the final runtime metadata, and it does not alter Convex, payment, deployment, or Production behavior.

## Required follow-up
1. Agent 2 reviews the exact head and validates whether package, lockfile, version files, CI, Vercel/Codemagic, and deployment instructions share one approved baseline.
2. Agent 1 corrects any valid finding in a focused follow-up PR.
3. Agent 3 performs the publication audit.
4. Convex #218/#310 remains a separate source↔environment and Development-first concurrency gate.
