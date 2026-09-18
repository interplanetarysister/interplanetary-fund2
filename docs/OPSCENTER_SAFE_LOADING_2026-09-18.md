# OpsCenter safe-loading correction — 2026-09-18

## Source
- Base: `main` at `034bd94b815cb803b5cc975418cc05b54e173250`
- File: `src/pages/OpsCenter.jsx`
- Queue owner: Issue #225; broader freshness/offline semantics remain Issue #90.

## Findings corrected
- Raw caught exception text was rendered through `e.message` in both initial load and Sync Now failure paths.
- Aggregate responses were trusted without record/array validation.
- Overlapping loads and unmount/remount could allow stale completions to mutate state.
- Sync Now had no single-flight guard.
- The page described cached Base44 data as making Ops Center work offline, which conflicted with the current no-offline-first product decision and Convex-authoritative mirror model.

## Scope boundary
This slice does not change the backend sync workflow, financial migration authority, Convex concurrency, RLS, or Production behavior. Issue #90 remains the owner of the broader mirror freshness/offline-semantics work, and #218/#310 remain the owner of deployed-source reconciliation and Development-first concurrency validation.

## Handoff requirements
- Rebaseline and validate the exact PR head with Node 22 locked install, lint, typecheck, build, and focused verifier.
- Add runtime-faithful malformed response, rapid refresh, unmount/remount, sync duplicate-click, response-loss, and admin authorization/RLS coverage.
- Confirm downstream Ops cards tolerate validated record rows and that no stale mirror wording remains elsewhere.
