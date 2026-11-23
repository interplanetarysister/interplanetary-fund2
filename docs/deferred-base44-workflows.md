# Deferred Base44 Workflows

This document records workflow history, retained capabilities, and current safety
constraints. Deferred automation must not be represented as active.

---

## GitHub Two-Way Sync

**Capability to preserve:** Conflict-safe two-way synchronization between the
Base44 sandbox and `interplanetarysister/interplanetary-fund2`, using Base44's
native GitHub synchronization control and a controlled GitHub identity.

**Health function:** `syncGitHub`
(`base44/functions/syncGitHub/entry.ts`)

### What is implemented

- An authenticated administrator can run a manual GitHub connection health
  check from the Integration Registry.
- The check reads the current `main` HEAD through the connected GitHub OAuth
  credential, records the observed SHA, and reports destination reachability.
- The Platform Access Registry is checked fail-closed before any provider call.
- Every completed check is audit-logged with the authenticated administrator as
  actor.
- No shell command, hardcoded token, source application, commit creation, or
  conflict resolution is performed by the deployed function.

### What is deferred and absent

- The scheduled GitHub workflow definition is intentionally absent.
- Base44 currently provides no repository-verified, server-verifiable workflow
  identity that `syncGitHub` can authenticate. A caller-supplied
  `initiator_type` value is only request data and must never grant access.
- Automated file-level push and pull remain deferred until conflict handling,
  attribution, rollback, and a trusted workflow identity are implemented and
  verified.

An unauthenticated invocation always receives `401`; an authenticated
non-admin receives `403`. The manual health check remains available to an
authenticated administrator. A scheduled call without a verifiable identity
must fail closed.

### Safe restoration contract

Restore scheduled synchronization only after all of the following have direct
hosted evidence:

1. Base44 supplies a server-verifiable workflow identity that cannot be forged
   in JSON, headers, or query parameters by an application caller.
2. `syncGitHub` validates that identity before using service-role access.
3. Negative tests prove anonymous, authenticated non-admin, and spoofed
   workflow-label requests are denied.
4. Conflict detection blocks divergent histories instead of overwriting them.
5. Commit attribution, audit records, rollback, and repository permissions are
   reviewed by an administrator.
6. Base44's native source synchronization remains the single source-application
   mechanism unless a separately reviewed replacement is adopted.

---

## External Fund Sync

**Policy:** External fundraising reads are request-triggered only. An
authenticated owner presses **Sync now** for their accounts/campaigns, or an
authorized admin submits one explicitly scoped request. Each request has a
UUID, a bounded job, ownership checks, deduplication, rate limiting,
provenance, and an auditable result.

The scheduled External Fund Sync workflow was removed. Do not restore cron,
polling, login/page-load triggers, agent-proactive imports, or workflow-driven
repetition. `poll_support` is provider research metadata, not runtime
authorization. Confirmed donation/payment webhooks, payment confirmations,
ledger updates, security events, and necessary settlement reconciliation remain
automatic and separate because they preserve financial integrity.

---

## Cloudflare agent and trigger continuation

The owner requested implementation and Cloudflare activation on November 4,
2026, referring to app/zip platform files. No supplied application ZIP was
available in this workspace. The existing canonical definitions were used:
ten agents under `base44/agents/` and seventeen workflows under
`base44/workflows/`, preserved in `host/workforce/` and `host/workflows/`.
This request did not establish verified cutover parity or authorize duplicate
execution alongside Base44.

The workflow staging script now preserves step identifiers, arguments,
transitions, complete step definitions, trigger conditions and full trigger
configuration. In particular, the volunteer follow-up retains its `P3D` wait;
the earlier manifest lost that delay. The audit no longer labels creation of
a `CampaignUpdate` as an incorrect update trigger. That event matches the
source workflow's documented purpose; its production behavior was preserved.

The workflow Worker provides inspection-only `GET /v1/workflows/preview`,
selected by `name` or by `entity` and `event`. Plans retain unresolved source
expressions and conditions; they neither evaluate authorization nor create
jobs. Unknown event/entity combinations return no matches. Unknown workflow
names return 404; malformed selectors return 400. Both Workers expose
`GET /v1/workflows/readiness` with outstanding activation requirements. The
workforce still has no executable agent runtime. Readiness is not inferred
from configuration flags.

Verification passed: `test-cloudflare-workflows.mjs`,
`verify-cloudflare-workflows.mjs`, `test-cloudflare-workforce-bootstrap.mjs`,
and `verify-cloudflare-workforce-stage.mjs`. Checks covered source parity,
event matching, delay/argument/transition/timezone preservation, malformed
requests and refusal to execute. No build, provider inference, metered Base44
operation, deployment or production event was triggered.

### Reuse discovery

GitHub repository metadata and license source files were inspected for
[Cloudflare Workers SDK](https://github.com/cloudflare/workers-sdk)
(Apache-2.0), [Temporal TypeScript SDK](https://github.com/temporalio/sdk-typescript)
(MIT), and [Inngest](https://github.com/inngest/inngest) (GitHub reported no
unambiguous SPDX license; its license source requires further review). All
three repositories were non-archived and showed recent activity. Retaining
the existing native Workers modules required no dependency addition, no new
credentials, and no external service cost. Temporal would require a separate
service/runtime; Inngest would introduce an unverified execution service and
licensing boundary. Neither was integrated. No dependency-license or security
clearance for those unused candidates is claimed. Existing Worker source was
adapted to avoid expanding privacy, hosting and billing boundaries.

### Activation checkpoint

No Cloudflare deployment token or account reference was available in the
runtime's conventional deployment variables, and no Cloudflare connector was
exposed. Deployment and live account/billing/permissions verification were
therefore unavailable. The previous dismissed chat questions could not be
recovered; the owner's latest answers remain the scope for continuation.

Next, use an authorized Cloudflare connection to read the existing account,
Worker configuration, bindings, deployment versions and confirmed free-plan
limits without printing credentials. Recover any missing app/ZIP artifact
through its actual platform attachment source. Reconcile existing agent
skills, identities, memory, consent and per-tool grants; implement and test
the missing execution adapters and durable job/idempotency boundary before
enabling any trigger. Reconcile outstanding delayed follow-ups and current
Base44 schedules so only one executor owns each action. Financial and
publishing operations require explicit negative authorization, duplicate,
replay and recovery tests, plus independently verified parity. The weekly
training's daily cron still needs investigation rather than a guessed edit.

Live activation remains incomplete. Keep execution disabled until those
requirements are verified. Rolling back this preparation means reverting
the preview/staging changes; no Base44 definitions, production routing,
credentials or active schedules were changed.

---

*Last updated: see git log for this file.*
