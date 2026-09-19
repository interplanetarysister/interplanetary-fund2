# Withdrawals review correction — 2026-09-18

## Scope
Focused correction for Issue #379 from exact current `main` `a1e2ab56386b6c072c82a97db76098b1df359f94`.

## Implemented
- Replaced raw caught-message propagation with stable user-facing copy.
- Added strict response-envelope and row-identity validation for campaigns, donations, withdrawal history, and admin review queue data.
- Added mounted/request-generation fencing for load completion and cleanup.
- Added per-withdrawal single-flight approval protection.
- Requires explicit `{ success: true }` approval evidence before refresh/success toast.
- Replaced the visible 3% fee text with the canonical 7% platform-fee policy constant.
- Added `scripts/verify-withdrawals-review-correction.mjs`.

## Deliberate boundary
This correction does not claim server-authoritative fee calculation, `requestWithdrawal`/`fraudControlAction` workflow completion, hosted RLS/service-role proof, durable provider idempotency, or Convex #218/#310 Development concurrency evidence. Those remain required review gates.

## Required Agent 2+3 gates
- Rebaseline and validate exact head with Node 22 locked install, lint, typecheck, production build, and focused verifier.
- Add runtime-faithful malformed/nullish/hostile provider response, response-loss/retry, duplicate approval, stale completion, unmount/remount, and no-raw-sink checks.
- Verify the backend remains the financial and authorization source of truth; the client fee constant is display-only until server evidence is attached.
- Review admin queue authorization/RLS/tenant isolation and provider payout semantics.
- Preserve the separate Convex deployed-source reconciliation and Development-first serialization/idempotency gate.

Keep Draft/open/unmerged. No merge, deployment, publication, or Production behavior change from Agent 1.
