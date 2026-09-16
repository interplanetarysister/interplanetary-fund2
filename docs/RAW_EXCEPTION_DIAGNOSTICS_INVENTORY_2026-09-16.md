# Raw Exception Diagnostics Inventory — 2026-09-16

## Purpose

This inventory records raw or conditionally raw exception diagnostics found on exact current `main` `d3a9cca10e8a83677530ac853f57118028867272`. It is a review artifact for Issue #94, not a claim that every site is unsafe or that remediation is complete.

## Evidence rule

Each entry must be rechecked against the exact current source before remediation. A site is not considered safe merely because it uses `.message`; the caller, sink, telemetry path, and hostile thrown-value behavior must be reviewed.

## Inventory

| Path | Observed pattern | Risk classification | Required next action |
| --- | --- | --- | --- |
| `src/lib/AuthContext.jsx` | `console.error(..., appError)` | Client-side raw exception object | Replace with bounded classifier; verify no sensitive auth/provider data reaches console or telemetry. |
| `base44/shared/auditLog.ts` | Conditional `message` or raw value in error log | Shared diagnostic sink | Bound classification and confirm audit payload privacy. |
| `base44/shared/rateLimit.ts` | Conditional `message` or raw value in fail-open log | Security control diagnostic | Preserve fail-open behavior while bounding diagnostics and avoiding secret leakage. |
| `base44/shared/activityEvent.ts` | Conditional `message` or raw value in event failure log | Shared event path | Bound diagnostics; verify no user/event payload leakage. |
| `src/pages/Onboarding.jsx` | Raw error object to `console.error` | Client-visible setup flow | Bound diagnostics; preserve user-safe toast behavior. |
| `base44/functions/getMyGiving/entry.ts` | `error?.message || error` | Financial/user data path | Bound diagnostics; verify no donation/account/provider data leakage. |
| `base44/functions/geocodeCity/entry.ts` | Raw `error` | External provider path | Bound diagnostics; preserve safe 500 response. |
| `src/components/agents/AgentChat.jsx` | Raw error object to `console.error` | AI/communications client path | Bound diagnostics; preserve safe assistant fallback. |
| `base44/functions/listConnections/entry.ts` | `error.message` | OAuth/provider connection path | Bound diagnostics; verify token/provider detail exclusion. |
| `base44/functions/welcomeVolunteer/entry.ts` | `e.message` | Email side effect | Bound diagnostics; preserve non-blocking behavior and avoid recipient/content leakage. |
| `base44/functions/publishPost/entry.ts` | Conditional raw publish error | External posting path | Bound diagnostics; preserve durable failure state and retry semantics. |
| `base44/functions/volunteerFollowUp/entry.ts` | `e.message` | Email side effect | Bound diagnostics; preserve non-blocking behavior. |
| `base44/functions/deleteAccount/entry.ts` | Step error detail interpolated into log/audit | Account deletion path | Bound diagnostics; preserve auditability without exposing raw provider/user data. |

## Acceptance criteria for remediation

1. Every entry is revalidated against the exact implementation head before editing.
2. Raw exception objects, stacks, messages, nested values, getters, symbols, and provider/user payloads do not reach client UI, console, analytics, or audit sinks unless an approved bounded classifier explicitly permits the result.
3. Hostile thrown-value coverage includes `Error`, strings, objects, nullish values, primitives, proxies/getters, and provider failure/response-loss cases where relevant.
4. Existing response contracts, safe user-facing copy, non-blocking email behavior, audit intent, and durable failure-state semantics are preserved.
5. Each remediation remains a focused commit/PR and is rebaselined from current `main` before final Agent 2+3 review.

## Status

Inventory only. Implementation is intentionally separate from this documentation slice. See Issue #94 for ordering and evidence requirements.
