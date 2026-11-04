# Migration quality-preservation contract

**Owner directive: 2026-11-03.** IFund is being migrated away from Base44. This supersedes the earlier Base44 portability freeze that treated Base44 as the intended permanent host. Base44 may remain a temporary rollback/reference source until the independent implementation passes parity gates; it is not the target architecture.

## Non-negotiable rule

A host change, rebuild, refactor, dependency replacement, or deployment must not reduce the existing product's behavior or quality. A build that succeeds after disabling, stubbing, simplifying, omitting, or weakening a capability is a failed migration, not a successful build.

Preserve the existing implementation as the behavioral reference. Modify existing artifacts in place where possible. Do not replace complete features with catalog-only endpoints, readiness-only endpoints, static snapshots, mock responses, placeholders, or permanent 503 responses and describe them as migrated.

## Required parity dimensions

- **Frontend and visual:** routes, layouts, responsive behavior, interactions, accessibility, image assets, image dimensions, aspect ratios, crop/focal-point behavior, responsive source sets, format/quality, loading states, and error handling.
- **Identity and authorization:** password login, email-code account recovery, session lifecycle, role/owner checks, RLS, delegated/OBO consent, credential isolation, and account deletion.
- **Data:** stable identifiers, complete entity/schema coverage, constraints, indexes, relationships, RLS policies, migrations, import/export, idempotency, audit history, and preservation of existing production records.
- **Payments:** PayPal behavior and ledger invariants, immutable donation identity/allocation, reconciliation, refunds/chargebacks, withdrawal rules, fee disclosures, and provider verification. Do not introduce Stripe as a replacement.
- **Agents:** every agent's instructions, role, tool allowlist, memory scope/retention/deletion, cross-agent delegation, context provenance, permissions, approvals, audit trail, and actual execution.
- **Workflows:** every trigger, filter/condition, schedule/timezone, step, function argument, branch, delay, retry, idempotency key, approval, audit event, and failure/replay behavior.
- **Integrations and communications:** OAuth lifecycle, provider capabilities, inbound/outbound delivery, webhooks, connection state, sync, retries, consent, and truthful verification status.
- **Operations:** observability, health checks, logs, alerts, backup/recovery, rate limits, cost controls, rollback, build artifacts, and production routing.

## Evidence and release gates

For every migrated capability, record the original source location, consumers, behavior/contract, destination implementation, data/security boundary, tests, and status. Use these states accurately: `inventory_only`, `implemented_unverified`, `verified_parity`, `cutover_ready`, or `blocked_external_dependency`.

A source file, staged JSON, catalog entry, successful compilation, green unit test, or reachable Worker does not prove runtime parity. A feature reaches `verified_parity` only after meaningful automated tests and an end-to-end test against the independent destination. Production cutover requires all production-critical features to reach `cutover_ready`, with rollback tested and no unresolved data/auth/payment integrity issue.

Never hide missing capabilities behind a generic fallback. Degraded/unavailable behavior must be explicit, observable, and non-destructive. Do not activate duplicate financial or publishing writers or create split-brain sources of truth.

## Findings confirmed from the current repository audit

These are blockers, not acceptable final implementations:

1. `host/workflows/worker.js` exposes a catalog but reports `execution: "disabled"`; all workflow execution paths return HTTP 503 and the scheduled handler performs no work. Staged definitions are not an executing workflow runtime.
2. `host/workforce/worker.js` reports `execution: "disabled"` and returns HTTP 503 for workforce actions. `host/workforce/` is a snapshot of agent/skill definitions, not a live agent runtime with verified tools, memory, authentication, permissions, and execution adapters.
3. `src/components/ui/image.jsx` applies Wix Media Platform transforms to `media.base44.com` and `static.wixstatic.com`. Removing the Base44 host from the transform allowlist without first migrating its assets and preserving equivalent image delivery would silently drop server-side resizing, responsive DPR source sets, WebP conversion, crop/focal-point handling, and blur-up behavior. Do not "fix" portability by degrading image delivery or replacing real assets with the generic logo fallback.
4. `.github/workflows/deploy-cloudflare.yml` still builds with Base44 application configuration and verifies an MCP proxy marked `x-ifund-mcp-proxy: base44`. The gateway also retains Base44-origin proxy behavior. A Cloudflare deployment therefore does not by itself prove Base44 independence.
5. The existing static dependency audit reports 1,038 call-site matches across 363 source files, including 46 referenced entities and 124 referenced functions. This is a static inventory only; it does not establish dynamic coverage or runtime completeness.

## Required implementation approach

1. Preserve the original source behavior and asset references while creating provider-neutral interfaces.
2. Implement independent Cloudflare/Supabase services for the actual operations, not just their metadata or route names.
3. Move assets to IFund-controlled storage with a verified URL/metadata mapping before removing legacy asset delivery. Preserve originals and image transformation quality; use a verified equivalent transformation pipeline or a quality-preserving responsive delivery strategy.
4. Port workflow execution with durable queue/state, event delivery/replay, schedule/timezone fidelity, idempotency, retries, step transitions, and audit records. Do not execute any workflow twice across old/new runtimes.
5. Port agent runtime with secure identity, permission-checked tools, scoped memory, deletion/retention controls, delegation, approvals, and auditable real execution.
6. Reconcile data and verify RLS/authorization before any writable cutover. Preserve PayPal as the payment rail and retain the canonical ledger rules.
7. Add automated parity tests and production smoke tests that fail when a feature is silently disabled, replaced by a placeholder, or removed from the build.
8. Cut over only after independent parity is proven. Until then, clearly label the destination as incomplete; do not claim production independence.

## Quality rule for rebuilds

No "simpler version" is an acceptable automatic fallback. Preserve current behavior and quality by default. Any intentional product change must be separately specified and approved by the owner; migration work itself is not permission to redesign or reduce scope.
