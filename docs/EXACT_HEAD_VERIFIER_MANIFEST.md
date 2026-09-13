# Exact-Head Verifier Manifest

Status: release-integrity inventory; documentation-only; does not authorize merge, deployment, publication, or Production promotion.

Date: 2026-09-13
Canonical repository: `interplanetary-fund2`
Runtime baseline for current release gates: Node 22.x with `npm ci`

## Purpose

This manifest is the canonical inventory for focused verifier scripts and their owning workstreams. A verifier is not considered part of repository-wide release coverage merely because a file exists on a branch or appears in a pull request. The owning PR must be on the exact candidate head, the command must be registered, and the exact-head workflow must execute it without omission.

## Current-main commands

The current `main` `package.json` exposes these deterministic checks:

- `test:fees` — fee calculation contract
- `test:stripe-idempotency` — Stripe idempotency contract
- `test:financial-integrity` — financial integrity contract
- `test:delete-account` — account deletion contract
- `test:paypal-limit` — PayPal order-limit contract
- `test:account-guard` — authentication/account guard contract
- `test:payments` — composed payment/financial guard suite
- `verify:analytics-safety` — Analytics safety contract
- `verify:stripe-webhook-errors` — Stripe webhook error contract
- `verify:edit-ai-profile-safe-errors` — AI profile safe-error contract

The current `main` package does **not** yet register every focused verifier present on active unmerged PR branches. That distinction is intentional and must remain visible until the PR is reconciled and validated.

## Active PR-local verifier inventory

| Workstream | Verifier / command | Status on current `main` | Required evidence |
|---|---|---:|---|
| Issue #239 / PR #240 | `verify:inbox-safety` | PR-local / unmerged | Exact-head runtime, malformed/provider privacy, overlap/retry/unmount, hosted auth/RLS review |
| Issue #241 / PR #242 | `verify:followed-campaigns-safety` | PR-local / unmerged | Mutation concurrency, rollback isolation, response-loss/idempotency, hosted privacy review |
| Issue #243 / PR #244/#245/#252 | `verify:discover-safety` | PR-local / unmerged | Malformed rows, refresh preservation, overlap/retry/unmount, caller/mobile review |
| Issue #254 / PR #255 | ConnectDialog verifier | PR-local / unmerged | Save-response integrity, credential boundary, caller/accessibility review |
| Issue #256 / PR #257/#284 | `verify:agent-platform-access-safe-errors` | PR-local / unmerged | Runtime auth/OBO failure classes, secret-reference-only response, hosted least privilege |
| Issue #258 / PR #259 | `verify:audit-log-safe-diagnostics` | PR-local / unmerged | Redaction/bounding, rejecting-sink runtime proof, retention/access review |
| Issue #260 / PR #261 | `verify:volunteer-signup-boundary` | PR-local / unmerged | Duplicate signup, counter behavior, notification and RLS review |
| Issue #262 / PR #263 | `verify:list-connections-safe-diagnostics` | PR-local / unmerged | Credential redaction, malformed rows, owner/admin scope, revoked-session review |
| Issue #265 / PR #266 | `verify:welcome-volunteer-boundary` | PR-local / unmerged | Email/notification side effects, preference gating, duplicate-trigger review |
| Issue #267 / PR #268 | `verify:list-institution-applications-boundary` | PR-local / unmerged | Ownership, projection/type safety, amount/date validation, hosted RLS review |
| Issue #219 / PR #269 | `verify:publish-post-safe-diagnostics` | PR-local / unmerged | Provider failure privacy, status/retry preservation, durable claim separation |
| Issue #270 / PR #271 | `verify:post-discussion-reply-boundary` | PR-local / unmerged | Auth, provider shape, counter update, replay/response-loss semantics |
| Issue #272 / PR #273 | `verify:auth-context-safe-diagnostics` | PR-local / unmerged | Cross-realm failure privacy, loading settlement, revoked-session review |
| Issue #274 / PR #275 | `verify:broadcast-posts-boundary` | PR-local / unmerged | Consent, provider failure, bounded projection, retry/idempotency, hosted privacy |
| Issue #276 / PR #277 | shared rate-limit verifier | PR-local / unmerged | Development contention, rollover, duplicate/replay, truthful remaining counts |
| Issue #278 / PR #279 | `verify:delete-account-boundary` | PR-local / unmerged | Stage failure privacy, anonymization fallback, retry/duplicate semantics, RLS |
| Issue #280 / PR #281 | `verify:get-campaign-donations-boundary` | PR-local / unmerged | Public/owner pending semantics, malformed rows, ledger consistency, RLS |
| Issue #282 / PR #283 | `verify:volunteer-follow-up-boundary` | PR-local / unmerged | Email safety, notification behavior, duplicate side effects, hosted privacy |
| Issue #285 / PR #286/#288 | geocode verifier | PR-local / unmerged | Provider timeout/abort, strict coordinates, Nominatim/privacy, caller review |
| Issue #289 / PR #290 | `verify:get-my-giving-boundary` | PR-local / unmerged | Confirmed-only semantics, financial privacy, malformed rows, response-loss |
| Issue #291 / PR #292 | `verify:create-donation-checkout-boundary` | PR-local / unmerged | Trusted origins, Stripe shape, durable idempotency, webhook/RLS/ledger proof |
| Issue #293 / PR #294 | subscription boundary verifier | PR-local / unmerged | Origin inventory, checkout idempotency, webhook entitlement reconciliation |
| Issue #295 / PR #296/#298 | agent-mail runtime verifier | PR-local / unmerged | OBO/revoked behavior, poisoned rows, projection/privacy, replay semantics |
| Issue #302 / PR #303/#305/#307 | ErrorBoundary verifier | PR-local / unmerged | Hostile thrown values, exact sink capture, focus/accessibility, route reset |
| Issue #304 / PR #305 | ErrorBoundary runtime contract | PR-local / unmerged | Exact component execution and browser/mobile/WebView compatibility |
| Issue #313 / PR #314 | `verify:record-campaign-created-boundary` | PR-local / unmerged | Real handler execution, auth/order/replay, hosted RLS/privacy, ID compatibility |
| Issue #30 / PR #316 | community membership verifier | PR-local / unmerged | Malformed rows, mutation failures, durable uniqueness/idempotency, RLS/privacy |

## Inclusion rules

1. Every new verifier must be named in the owning PR body and added to this manifest in the same focused change.
2. A verifier must execute against the exact PR head; stale-head success is not valid evidence.
3. `npm ci`, lint, typecheck, production build, deterministic checks, and every required verifier must run without skipped steps.
4. Runtime, hosted authorization/RLS, caller/mobile/accessibility, dependency, and Development concurrency evidence remain separate gates; one does not substitute for another.
5. If a verifier is intentionally not run, the workflow and handoff must record the reason as blocked/incomplete rather than silently omitting it.
6. This manifest must not be used to infer that a feature or integration is complete; it only records validation coverage and ownership.

## Ownership and promotion boundary

- Agent 1 may add or update this inventory and create focused reviewable PRs.
- Agent 2+3 must review the exact candidate head and confirm verifier completeness.
- Agent 3 is the final publication authority.
- No entry in this document authorizes merge, deployment, Base44 sync, or Production behavior change.
