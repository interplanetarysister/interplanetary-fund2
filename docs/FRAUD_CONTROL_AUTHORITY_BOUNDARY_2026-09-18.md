# Fraud Control authority boundary — 2026-09-18

## Exact source
- Repository: `interplanetarysister/interplanetary-fund2`
- Base: `main`
- Base SHA: `72a77bd7c39bf2e1a270dc14d22bc3b2ef4b4794`
- File: `src/components/platform/FraudControlPanel.jsx`

## Confirmed current-main findings
- The page directly calls `base44.entities.Withdrawal.update(...)` for approve and deny.
- The page directly calls `base44.entities.Campaign.update(...)` for pause and restore.
- The page renders `e.message` from caught exceptions.
- The page comment says admin-only, but the repository evidence here does not establish a server-derived privileged authorization boundary or a single-winner claim before payout/provider side effects.

## What this slice does
- Adds an executable source-contract guard: `verify:fraud-control-authority-boundary`.
- The guard fails if direct privileged entity mutations or raw caught-message propagation return to the page.
- The guard intentionally does not claim to implement the missing authoritative server workflow.

## Required next implementation evidence
1. Reconcile the existing `requestWithdrawal` and `fraudControlAction` workflows and their actual deployed ownership.
2. Identify the supported conditional-update/claim/idempotency primitive.
3. Move privileged reads and writes behind the authoritative workflow or disable the controls until that workflow is available.
4. Prove duplicate approve/deny, approve-vs-deny race, stale worker, provider ambiguity, local finalization failure, and replay behavior in Development.
5. Re-run exact-head Node 22 locked no-skip checks and the complete verifier chain before any approval or publication.

## Safety boundary
This documentation and verifier do not authorize Production behavior changes, merge, deployment, or publication. The Convex #310/#218 source↔environment and Development-first reliability gate remains independent and higher priority.