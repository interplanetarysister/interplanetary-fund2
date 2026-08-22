# Platform Foundation Contracts

Status: Feature #10 implementation baseline

This document defines the shared contracts that all Interplanetary Fund operating systems must follow. It is intentionally small: it records boundaries that can be enforced in code without creating a second backend or agent-memory system.

## Source of truth

- `interplanetary-fund2` owns the user-facing Base44 application layer.
- `interplanetarysister/InterplanetaryFund` owns authoritative persistent backend and agent state.
- `interplanetary-fund-backend` is reference-only.

A frontend component must not create a competing persistent agent-memory, campaign-ledger, treasury, or scheduled-intelligence store.

## Event contract

Every cross-OS event should have these fields before it is dispatched to another subsystem:

```text
id              globally unique event identifier
name            stable namespaced event name, e.g. campaign.created
version         integer contract version
occurred_at     ISO-8601 timestamp
actor_id        authenticated actor or system identity
resource_type   canonical resource type
resource_id     canonical resource identifier
correlation_id  identifier shared across one user action/workflow
idempotency_key stable key for retry-safe processing
payload         versioned event data; no secrets
```

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

A retry must never create a second donation, send a duplicate communication, or execute a duplicate external publish merely because the first response was lost.

## Environment boundary

Development, preview/test, and production credentials/data must never be mixed. Secrets remain in the runtime secret store and are never committed to source. Production webhook/signing secrets must not be used by local or preview workflows.

## Observability contract

Platform health checks report the health of a capability, not merely whether a UI component rendered. Each check records:

- capability name;
- operational/degraded status;
- measured latency;
- sanitized error category/message when degraded;
- check timestamp.

Health checks should use bounded timeouts so one unavailable dependency cannot hang the entire platform console.

## Change discipline

Feature work must extend these contracts rather than creating parallel conventions. When an existing implementation conflicts with a contract, preserve working behavior where possible and make the smallest evidence-backed correction.
