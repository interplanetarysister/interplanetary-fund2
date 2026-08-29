# Issue #13 — Agent Actionability / Approved Execution Plan

Status: planning-only. This document is not implementation or runtime evidence.

## Objective

Make the named AI agents capable of completing approved, bounded actions on behalf of a user instead of only discussing actions, while keeping authorization explicit, user-facing responses concise, and internal reasoning private.

## Current architecture constraints

- Reuse existing agent/action, connection, campaign, communication, and platform-event boundaries where they already provide authoritative authorization or idempotency.
- Do not create a second agent framework when an existing capability can be extended safely.
- Do not let an LLM response itself authorize a consequential action.
- Never expose chain-of-thought or hidden reasoning to users. Agents should return a concise result, status, and next step when needed.
- Provider credentials, OAuth secrets, payment data, and other sensitive connection fields must never be placed into prompts or user-visible output.
- A missing provider configuration must result in a guided setup flow, not fabricated credentials or an assertion that the agent can retrieve secrets it is not authorized to access.

## Proposed agent model

1. **Chief of Staff** — cross-domain planning and orchestration. It may propose or execute approved actions by invoking bounded tools; it does not become a general-purpose unrestricted executor.
2. **Strategy** — campaign/fundraising strategy, recommendations, prioritization, and approved campaign-operation actions.
3. **Communications & Outreach** — combine the overlapping communication/outreach responsibility into one user-facing specialist for drafting, audience targeting, connection setup guidance, and approved publishing/communication actions.
4. **Campaign Discovery** — identify external campaign-posting opportunities and requirements, rank them, and prepare actions. It must not create third-party accounts or publish externally without the required user authorization and connector boundary.

The final agent count and exact names must be reconciled against the current repository agent registry before implementation; this plan intentionally does not guess at existing IDs or schemas.

## Action execution contract

Every consequential agent action should resolve to an explicit action envelope before execution:

- authenticated user identity;
- agent identity/capability;
- requested action type;
- target resource and owner;
- exact intended side effect;
- user authorization state and scope;
- idempotency key;
- execution status (`proposed`, `awaiting_approval`, `approved`, `executing`, `succeeded`, `failed`, `needs_setup`, `needs_user_input`);
- safe user-facing result;
- server-side diagnostic reference where appropriate.

The model may propose an envelope. Only an authoritative server workflow may validate authorization and perform the side effect.

## Approval semantics

- Read-only analysis can remain immediate.
- Consequential actions require explicit user approval unless an existing durable account-level authorization already covers that exact action class and destination.
- Financial movement, credential changes, account creation, deletion, irreversible moderation, and external publishing must retain their existing high-risk authorization boundaries and must not inherit broad agent permission automatically.
- An approval must be scoped to the concrete action or an existing documented durable authorization policy; natural-language intent alone is insufficient.

## Provider/API setup behavior

When a required connector is unavailable:

1. explain simply that the connection is not ready;
2. identify the exact setup step the user must perform;
3. route to the existing Connections Center/OAuth flow when available;
4. preserve the pending action without executing it;
5. never ask the model to invent, expose, or recover secrets outside an authorized connector.

If a provider supports an OAuth flow, use that flow rather than asking users to paste long-lived secrets unless the current provider architecture explicitly requires it.

## Idempotency and retries

Agent execution must use the existing durable event/job or action-claim infrastructure where available. Consequential operations must be safe under duplicate requests, retries, and worker restarts. A provider-success/local-write-failure condition must be recoverable without blindly repeating an external side effect.

This requirement is especially important because the platform currently has an unresolved Convex automation concurrency issue. Agent action execution must not introduce another parallel write path that competes for shared automation state.

## User experience contract

Agent responses should default to:

- what was done;
- what could not be done;
- what the user needs to do next;
- one useful result or link/action when available.

Do not expose hidden reasoning, internal deliberation, raw tool payloads, credentials, stack traces, or implementation details unless a user explicitly asks for technical detail and it is safe to provide.

## Cross-platform dependency analysis

Before implementation, inspect and map:

- current agent registry/components/prompts;
- existing action/tool invocation boundaries;
- Connections Center and PlatformConnection schema;
- campaign creation/update workflows;
- communication/send workflows;
- publishing/distribution paths and Issue #64 durable publishing work;
- OAuth/MCP consent routes;
- platform-event/task-relay/idempotency infrastructure;
- financial authorization boundaries;
- current Convex automation orchestration and unresolved concurrency repair;
- mobile/web surfaces that invoke agent actions.

No new parallel implementation should be created where an authoritative existing workflow already owns the behavior.

## Implementation sequence after plan approval

1. Inventory current agents and action surfaces.
2. Define the smallest shared action contract that fits the current architecture.
3. Implement one low-risk read/action workflow end-to-end.
4. Add explicit authorization and idempotency tests.
5. Implement Communications & Outreach consolidation only after verifying both existing agents and callers.
6. Add Campaign Discovery as a bounded research/recommendation capability, with execution delegated to existing approved publishing workflows.
7. Expand other agents only where the same contract is proven safe.
8. Validate web/mobile UX and concise response behavior.
9. Run exact-head CI and Development runtime tests.
10. Submit the exact implementation head to Agent 2+3, correct every valid blocker, then obtain Agent 3 final publication review.

## Acceptance criteria

- Agents can perform at least one real approved action through an authoritative server workflow rather than merely describing it.
- Unauthorized or unconfigured actions fail closed and provide a useful setup/approval path.
- Duplicate execution does not create duplicate consequential side effects.
- Users never receive credentials, raw provider errors, or hidden reasoning.
- Existing protected financial, deletion, moderation, OAuth, and publishing boundaries remain intact.
- Communications/outreach consolidation does not orphan existing callers.
- Campaign Discovery does not silently create third-party accounts or publish without required authorization.
- Development runtime evidence covers ordinary user and administrator authorization where relevant.
- Exact-head CI and Agent 2+3 audit evidence correspond to the final implementation SHA.
