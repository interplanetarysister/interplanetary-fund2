# Withdrawals Payment Boundary — 2026-09-18

## Current-main evidence

- Base: `72a77bd7c39bf2e1a270dc14d22bc3b2ef4b4794`
- Source: `src/pages/Withdrawals.jsx`
- Queue owner: Issue #379

## Confirmed risks

The exact-main source currently exposes raw caught exception text through the page error and admin approval toast paths, trusts several provider/entity payloads with weak/nullish fallbacks, and permits approval re-entry without a per-withdrawal single-flight guard. Reloads also lack explicit mounted/generation fencing.

## Scope of this PR

This PR adds a focused source-contract verifier and records the boundary for combined Agent 2+3 review. It does not claim the underlying payment workflow, server authorization/RLS, provider verification, durable idempotency, or Convex concurrency repair is complete.

## Required follow-up before approval

1. Replace raw diagnostics with stable safe copy and preserve existing recovery behavior.
2. Validate auth, campaign, donation, withdrawal, and approval response envelopes before state commit.
3. Add per-withdrawal duplicate-approval prevention plus mounted/request-generation fencing.
4. Prove hosted authorization/RLS/tenant isolation and the authoritative `requestWithdrawal`/`fraudControlAction` workflow.
5. Run exact-head Node 22 locked install, lint, typecheck, production build, and this verifier with no skips.
6. Add Development-first duplicate/replay/response-loss evidence; do not promote to Production from Agent 1.
