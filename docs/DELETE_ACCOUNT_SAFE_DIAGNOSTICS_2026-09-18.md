# deleteAccount Safe Diagnostics — 2026-09-18

## Source
`base44/functions/deleteAccount/entry.ts` at exact `main` `72a77bd7c39bf2e1a270dc14d22bc3b2ef4b4794`.

## Finding
The account-deletion workflow interpolated `stepErr.message`, `String(stepErr)`, and `error.message` into console and persisted audit details. That could expose provider/internal exception content at a privacy and account-lifecycle boundary.

## Bounded correction
- Added a fixed low-cardinality thrown-value classifier that does not read arbitrary `.message` properties.
- Added a strict allowlist for deletion step names before diagnostics are emitted.
- Replaced raw exception content with stable `scope:dependency_failure:category` diagnostics.
- Preserved the existing deletion state machine, step ordering, retry-safe cleanup intent, user-facing 500 copy, and anonymization fallback.
- Added a focused source-contract verifier.

## Deliberate boundaries
This slice does not claim hosted authorization/RLS proof, service-role abuse review, durable worker claiming/idempotency, Convex deployment reconciliation, Development runtime evidence, or Production promotion.

## Handoff
Agent 2+3 must rebaseline against the exact current `main`, run Node 22 locked checks and the focused verifier, execute hostile thrown-value and partial-failure/retry/replay coverage, inspect audit privacy and deletion semantics, and verify that no raw diagnostics reach console, telemetry, UI, or persisted records.
