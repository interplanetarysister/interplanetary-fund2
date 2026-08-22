# Platform Foundation Contracts

Status: Feature #10 implementation baseline — enforced application-layer subset

This document defines the shared contracts that all Interplanetary Fund operating systems must follow. The application layer now validates the event registry, event versions, identity fields, payload shape/size, retry inputs, retry attempt ceiling, idempotency-key presence, and safe error classification. Authoritative Convex persistence/execution remains the next integration boundary; these helpers do not create a competing backend.

## Source of truth

- `interplanetary-fund2` owns the user-facing Base44 application layer.
- `interplanetarysister/InterplanetaryFund` owns authoritative persistent backend and agent state.
- `interplanetary-fund-backend` is reference-only.

A frontend component must not create a competing persistent agent-memory, campaign-ledger, treasury, or scheduled-intelligence store.

## Event contract

Every cross-OS event should have these fields before it is dispatched to another subsystem:

```text
id              globally unique event identifier
name            stable namespaced event name from the registered event catalog
version         integer contract version
occurred_at     ISO-8601 timestamp
actor_id        authenticated actor or system identity
resource_type   canonical resource type
resource_id     canonical resource identifier
correlation_id  identifier shared across one user action/workflow
idempotency_key stable key for retry-safe processing
payload         versioned event data; no secrets; bounded in size
```

The application event constructor rejects unregistered names, unsupported versions, invalid timestamps, missing identity/resource/idempotency fields, non-object payloads, and oversized payloads. `PlatformEvent` persists the event ID, version, correlation ID, idempotency key, and timestamp alongside the existing audit fields.

Current registered application events are:

- `platform.configuration.changed`
- `platform.health_check.executed`
- `platform.knowledge.updated`
- `platform.deployment.executed`
- `platform.security.action`
- `platform.recovery.executed`
- `platform.event.recorded`

The authoritative Convex event/job paths still require repository-level integration verification before this contract can be called fully enforced across the entire platform.

Event consumers must be safe to receive the same event more than once. They must not treat delivery order as guaranteed unless the event contract explicitly says so.

## Authorization boundary

- Authentication is required for protected user actions.
- Ownership, role, permission, and campaign-scoped authorization are checked at the authoritative mutation boundary, not only in UI controls.
- AI recommendations are not authorization. An AI-generated recommendation cannot bypass a human approval or explicit automation consent requirement.
- Service-role operations are reserved for trusted server workflows and must preserve enough ownership/audit metadata to explain why the operation occurred.

## Job/retry contract

Scheduled and asynchronous work must be:

1. idempotent or guarded by a durable idempotency key;
2. bounded with explicit retry behavior;
3. observable through outcome/error records;
4. safe when a prior attempt partially succeeded;
5. separated from interactive request latency where practical.

The shared `withRetry` helper now requires an idempotency key, caps attempts at five, validates numeric retry inputs, and passes the same key to every attempt. This makes accidental retry configuration unsafe by default, but it does **not** replace durable Convex-side idempotency storage. A retry must never create a second donation, send a duplicate communication, or execute a duplicate external publish merely because the first response was lost.

## Error safety

User-facing platform errors are classified into a small allowlisted set of safe messages. Raw backend/provider messages are never truncated and displayed as-is; unknown errors resolve to a generic availability message. Internal diagnostic details belong in authorized logs rather than user-visible UI.

## Environment boundary

Development, preview/test, and production credentials/data must never be mixed. Secrets remain in the runtime secret store and are never committed to source. Production webhook/signing secrets must not be used by local or preview workflows.

## Observability contract

Platform health checks report the health of a capability, not merely whether a UI component rendered. Each check records:

- capability name;
- operational/degraded status;
- measured latency;
- sanitized error category/message when degraded;
- check timestamp.

Health checks use bounded UI waits so one unavailable dependency cannot hang the platform console. The current Base44 SDK calls do not expose a cancellation signal, so a timeout is treated as a UI bound rather than cancellation of the underlying request; repeated interactive checks are prevented while a run is active.

## Verification

Run `npm run verify:platform-foundation` to exercise the event registry, payload validation, safe error classification, retry idempotency requirement, retry ceiling behavior, and successful retry path.

## Change discipline

Feature work must extend these contracts rather than creating parallel conventions. When an existing implementation conflicts with a contract, preserve working behavior where possible and make the smallest evidence-backed correction.
