# Issue #14 — Human-Use Assessment & Implementation Plan

Status: **Planning only — no runtime changes**

Base SHA: `9122be4529685fd9b0687711b442fba6b8ceb260`

## Purpose

Reconcile the human-use requirements recorded in Issue #14 against the current repository before changing implementation. This document is an assessment/plan artifact, not proof that any item works and not authorization to bypass the P0 runtime/security queue.

## Evidence rules

- Use the current exact repository head as the source for implementation claims.
- Do not infer backend behavior from a visible button, route, placeholder, or component name.
- A capability is **UNKNOWN / REQUIRES VERIFICATION** until its actual action path, authorization boundary, persistence, external side effect, failure behavior, and runtime validation are established.
- Do not create a second implementation when an existing canonical issue/system owns the capability.
- Do not reuse stale PR evidence after `main` changes.
- UI visibility is not authorization; consequential actions require server/backend enforcement.

## Initial repository assessment

### 1. Dialogs / popups

Known shared primitives include:

- `src/components/ui/dialog.jsx`
- `src/components/ui/alert-dialog.jsx`
- `src/components/ui/sheet.jsx`
- `src/components/connections/ConnectDialog.jsx`

Assessment required before implementation:

- inventory highest-use callers and nested-dialog cases;
- verify Escape handling, explicit close controls, focus return, focus containment, overlay behavior, scroll locking, and mobile viewport behavior;
- distinguish a shared primitive defect from caller-specific misuse;
- test keyboard and touch closure without changing unrelated dialog semantics.

### 2. Globe

Issue #14 reports incomplete rendering. Current exact implementation and asset ownership must be located before modification.

Required assessment:

- identify the canonical Globe component and route callers;
- determine whether rendering is CSS/container sizing, asset loading, canvas/WebGL failure, data loading, or navigation obstruction;
- record desktop/mobile viewport behavior;
- preserve the intended Globe visual asset/style owned by the separate Globe requirement instead of introducing an unrelated replacement;
- validate loading, empty, error, and unavailable states.

Current status: **UNKNOWN / REQUIRES VERIFICATION** until the exact implementation and runtime failure are reproduced.

### 3. Inbox / platform messages

Issue #14 requires tracing the real event path rather than treating Inbox UI as delivery.

Canonical dependencies to reconcile:

- communication hub: Issue #28 / IF Feature #5;
- automated communication/notification intelligence: Issue #40 / IF Feature #17;
- Message audit/security: PR #116 / Issue #116;
- distribution/publishing: Issues #62/#64/#70/#81;
- synchronization: Issues #79/#80;
- provider-specific integrations such as Ko-fi: #66/#71.

Required map:

`provider event/webhook or authoritative in-app event -> ingestion -> normalization -> canonical Message/Inbox record -> notification -> user-visible Inbox`

For every supported provider, record:

- external event identity;
- source/provider/channel;
- authenticated owner/recipient;
- canonical record created;
- duplicate/replay handling;
- delivery state;
- failure/retry behavior;
- audit record;
- UI action and authorization.

Current status: **NOT COMPLETE**. Do not implement a second inbox/feed path.

### 4. Inbox / campaign posts

Required map:

`campaign -> Distribution/DistributedPost -> provider publication/sync -> authoritative status/event -> Inbox representation`

The implementation must reuse the canonical distribution/synchronization architecture. A visible campaign-post item is not sufficient unless it has authoritative lineage to the originating campaign/post and a durable event identity.

Current status: **UNKNOWN / REQUIRES VERIFICATION**.

### 5. Outside-platform interactions

Required provider matrix:

| Provider/event source | Connection owner | Ingestion path | Durable external ID | Canonical record | Delivery truth | Retry/idempotency | Status |
|---|---|---|---|---|---|---|---|
| Facebook | verify | verify | verify | verify | verify | verify | UNKNOWN |
| Instagram | verify | verify | verify | verify | verify | verify | UNKNOWN |
| TikTok | verify | verify | verify | verify | verify | verify | UNKNOWN |
| LinkedIn | verify | verify | verify | verify | verify | verify | UNKNOWN |
| Supported crowdfunding destinations | verify | verify | verify | verify | verify | verify | UNKNOWN / coming-soon where applicable |
| Ko-fi | verify | verify | verify | verify | verify | verify | UNKNOWN |

No provider should be represented as connected or delivering events without authoritative connection/provider evidence.

### 6. Simple human UX

Coordinate with the existing human-use queue instead of duplicating it.

- Issue #13 owns agent actionability/approved execution.
- Issue #19 owns campaign creation/media requirements.
- Issue #53 owns responsive shell/navigation/Globe/Inbox integration after its dependencies are ready.
- Issue #69 requires complete page action-surface documentation and permission mapping.

Candidate UX checks:

- child-simple campaign creation;
- concise agent responses;
- mobile-safe multiline fields;
- clear currency/goal input;
- appropriately sized Donate control;
- immediate campaign hero content;
- no horizontal overflow or clipped controls;
- keyboard/touch accessibility.

These are requirements to assess, not implementation claims.

## Action-surface audit requirement

Before any Issue #14 runtime change, document the affected page's complete action surface per Issue #69:

1. route and entry conditions;
2. every visible and programmatically reachable action;
3. authenticated role/ownership requirement;
4. frontend caller;
5. backend function/API;
6. records read/written;
7. external side effects;
8. validation and safe errors;
9. audit/activity records;
10. failure/retry/replay behavior;
11. direct invocation behavior outside the UI;
12. mobile/accessibility implications.

## Implementation order

1. Keep P0 Convex source/deployment/runtime reconciliation ahead of UX publication.
2. Keep P0/P1 financial and authorization boundaries ahead of human-use polish.
3. Finish the page/action-surface assessment for the exact candidate surface.
4. Map each discovered defect to an existing canonical issue.
5. Create a focused implementation PR only for a materially distinct, verified gap.
6. Agent 2+3 reviews the exact plan/head before implementation where required by the workflow.
7. Implement only the approved scope.
8. Run exact-head CI and applicable Development/browser/mobile validation.
9. Correct all valid Agent 2+3 findings on the same exact head.
10. Agent 3 performs the final publication audit.

## Explicit non-goals

- No new inbox/feed architecture.
- No fake provider events or delivery states.
- No client-only authorization.
- No speculative provider credentials/configuration.
- No replacement Globe asset without reconciling the canonical Globe requirement.
- No broad global CSS/UI rewrite without evidence of a shared root cause.
- No Production deployment as part of this planning artifact.

## Acceptance for a future implementation PR

A future Issue #14 implementation is complete only when the affected end-to-end action path is demonstrably functional, authorization is enforced server-side, external activity has authoritative lineage, failures/retries are understood, duplicate events/actions are safely handled, mobile/basic use is simple, accessibility is checked, exact-head CI passes, Agent 2+3 approves the corrected head, and Agent 3 completes the publication audit.
