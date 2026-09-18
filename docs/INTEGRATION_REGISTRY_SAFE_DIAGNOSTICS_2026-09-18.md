# Integration registry safe diagnostics — 2026-09-18

## Source
Exact current `main` `72a77bd7c39bf2e1a270dc14d22bc3b2ef4b4794`, `base44/shared/integrationRegistry.ts`.

## Finding
The shared helper accessed raw thrown messages/objects in `emitIntegrationAlert`, `assertPlatformAccess`, and `assertOboGrant` catch paths. These helpers are reused by integration health, platform access, admin, and on-behalf-of authorization flows.

## Implemented boundary
- Adds a fixed low-cardinality `classifyDiagnostic` helper.
- Replaces raw exception interpolation with `{ type }` metadata only.
- Preserves `emitIntegrationAlert` best-effort behavior.
- Preserves `assertPlatformAccess` fail-open registry-read contract.
- Preserves `assertOboGrant` fail-closed unavailable-grant contract.
- Adds focused source-contract verification.

## Deliberate non-goals
No schema, authorization, provider, Convex concurrency, dependency, deployment, or publication changes are claimed. Development/Production runtime mapping remains governed by the Convex #218/#310 gate.

## Review handoff
Agent 2+3 must rebaseline against exact current `main`, run Node 22 locked no-skip validation, exercise Error/string/object/nullish/primitive/getter/proxy throws, verify representative callers and fail-open/fail-closed semantics, and confirm no raw diagnostic reaches logs, telemetry, UI, or persisted records.
