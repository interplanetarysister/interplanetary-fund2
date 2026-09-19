# Raw Exception Diagnostics Inventory — 2026-09-16

## Purpose

This inventory records raw or conditionally raw exception diagnostics found on exact current `main` `d3a9cca10e8a83677530ac853f57118028867272`. It is a review artifact for Issue #94, not a claim that every site is unsafe or that remediation is complete.

## Exact-head discovery method

- Repository scope: `interplanetarysister/interplanetary-fund2` only.
- Source ref: exact current `main` `d3a9cca10e8a83677530ac853f57118028867272`.
- Discovery search families: `console.error`, `console.warn`, `console.log`, `error.message`, `e.message`, `error?.message`, raw `error`/`e` arguments, and error interpolation into audit/event payloads under `src/` and `base44/`.
- Exclusions: test fixtures, documentation-only examples, generated/vendor files, and already-bounded sinks covered by PR #303/#305/#307/#309 and PR #322.
- Completeness rule: every result was manually mapped to an exact expression/sink and assigned one evidence status below. Any new exact-head result must be appended before remediation begins.

## Evidence status definitions

- **confirmed-raw** — raw exception object/value or unbounded message reaches a diagnostic sink.
- **conditional-unbounded** — a conditional branch may emit raw message/value depending on thrown shape or caller.
- **already-bounded/false-positive** — exact source inspection shows the sink is bounded or not an exception sink; retained only to document review disposition.
- **unresolved** — source shape or downstream sink requires runtime-faithful inspection before classification.

## Inventory

| # | Exact path | Exact expression/sink | Evidence status | Risk classification | Owning work | Required next action |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/lib/AuthContext.jsx` | `console.error(..., appError)` | confirmed-raw | Client auth/provider diagnostics | Issue #94; new remediation PR required | Replace with bounded classifier; verify no auth/provider data reaches console or telemetry. |
| 2 | `base44/shared/auditLog.ts` | Conditional `message` or raw value in error log | conditional-unbounded | Shared diagnostic sink | Issue #94; new remediation PR required | Identify exact branch and payload shape; bound classification and confirm audit privacy. |
| 3 | `base44/shared/rateLimit.ts` | Conditional `message` or raw value in fail-open log | conditional-unbounded | Security-control diagnostic | Issue #94; new remediation PR required | Preserve fail-open behavior while bounding diagnostics and avoiding secret leakage. |
| 4 | `base44/shared/activityEvent.ts` | Conditional `message` or raw value in event failure log | conditional-unbounded | Shared event path | Issue #94; new remediation PR required | Bound diagnostics; verify no user/event payload leakage. |
| 5 | `src/pages/Onboarding.jsx` | Raw error object to `console.error` | confirmed-raw | Client setup flow | Issue #94; new remediation PR required | Bound diagnostics; preserve user-safe toast behavior. |
| 6 | `base44/functions/getMyGiving/entry.ts` | `error?.message || error` | conditional-unbounded | Financial/user-data path | Issue #94; new remediation PR required | Bound diagnostics; verify no donation/account/provider data leakage. |
| 7 | `base44/functions/geocodeCity/entry.ts` | Raw `error` | confirmed-raw | External provider path | Issue #94; new remediation PR required | Bound diagnostics; preserve safe 500 response. |
| 8 | `src/components/agents/AgentChat.jsx` | Raw error object to `console.error` | confirmed-raw | AI/communications client path | Issue #94; new remediation PR required | Bound diagnostics; preserve safe assistant fallback. |
| 9 | `base44/functions/listConnections/entry.ts` | `error.message` | conditional-unbounded | OAuth/provider connection path | Issue #94; new remediation PR required | Bound diagnostics; verify token/provider detail exclusion. |
| 10 | `base44/functions/welcomeVolunteer/entry.ts` | `e.message` | conditional-unbounded | Email side effect | Issue #94; new remediation PR required | Bound diagnostics; preserve non-blocking behavior and avoid recipient/content leakage. |
| 11 | `base44/functions/publishPost/entry.ts` | Conditional raw publish error | conditional-unbounded | External posting path | Issue #94; new remediation PR required | Bound diagnostics; preserve durable failure state and retry semantics. |
| 12 | `base44/functions/volunteerFollowUp/entry.ts` | `e.message` | conditional-unbounded | Email side effect | Issue #94; new remediation PR required | Bound diagnostics; preserve non-blocking behavior. |
| 13 | `base44/functions/deleteAccount/entry.ts` | Step error detail interpolated into log/audit | confirmed-raw | Account deletion path | Issue #94; new remediation PR required | Bound diagnostics; preserve auditability without exposing raw provider/user data. |
| 14 | `base44/shared/integrationRegistry.ts` | `e && e.message ? e.message : e` in `console.error` | conditional-unbounded | Integration/provider diagnostics | Issue #94; new remediation PR required | Bound diagnostics; verify credential/provider detail exclusion. |
| 15 | `base44/functions/recordDonation/entry.ts` | Additional exact-head diagnostic sink identified by review | unresolved | Financial ingestion path | Issue #94; new remediation PR required | Revalidate exact expression and downstream visibility before remediation. |
| 16 | `src/pages/Profile.jsx` | Additional exact-head diagnostic sink identified by review | unresolved | Client profile path | Issue #94; new remediation PR required | Revalidate exact expression and whether any user-visible/error boundary path is involved. |
| 17 | `src/components/ErrorBoundary.jsx` | Additional exact-head diagnostic sink identified by review | already-bounded/false-positive | Client error boundary | PRs #303/#305/#307/#309 | Preserve existing owner; do not duplicate remediation in this PR. |

## Cross-check against active remediation work

- ErrorBoundary sinks are owned by PRs #303/#305/#307/#309 and are not duplicated here.
- ServiceHealthPanel is owned by PR #322 and is not duplicated here.
- `src/components/ErrorBoundary.jsx` is retained as an explicit already-bounded/owned disposition only.
- All other rows remain unowned remediation candidates under Issue #94 until a focused PR is opened.
- Convex automation concurrency remains a separate source-of-truth/Development-first workstream under Issue #310/#218 and is intentionally excluded from this inventory.

## Acceptance criteria for remediation

1. Every entry is revalidated against the exact implementation head before editing.
2. Raw exception objects, stacks, messages, nested values, getters, symbols, and provider/user payloads do not reach client UI, console, analytics, or audit sinks unless an approved bounded classifier explicitly permits the result.
3. Hostile thrown-value coverage includes `Error`, strings, objects, nullish values, primitives, proxies/getters, and provider failure/response-loss cases where relevant.
4. Existing response contracts, safe user-facing copy, non-blocking email behavior, audit intent, and durable failure-state semantics are preserved.
5. Each remediation remains a focused commit/PR and is rebaselined from current `main` before final Agent 2+3 review.

## Status

Inventory updated after combined Agent 2+3 audit. Documentation-only queue artifact; implementation is intentionally separate from this PR. See Issue #94 for ordering and evidence requirements.
