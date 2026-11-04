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


---

## Incremental implementation contract — owner instruction 2026-11-03

Work proceeds one shared service, agent, or user-facing page at a time. Existing commits, branches, PRs, schemas, tests, and implementation evidence are cumulative project work: preserve and reconcile them; do not restart or discard them because the migration direction has been clarified. Before each task, inspect its existing source, all consumers, canonical tracker, prior PRs, and current verification. Continue from the exact remaining work.

A page or agent is not complete because it renders, compiles, has a source definition, appears in a catalog, or has a green static test. It is complete only when its promised user-facing behavior and every connected function are working, authorized, accessible, responsive, failure-safe, and verified end-to-end on the intended independent runtime.

### Seven migration categories and implementation ownership

| Category | Existing work to preserve | Independent implementation | Current evidence-based status |
|---|---|---|---|
| Authentication and identity | Existing Login/Register/ForgotPassword/ResetPassword/OAuthConsent/DeviceActivation/ConnectedDevices pages, AuthContext, protected routes, role checks, OAuth grants, OBO authorization, device flows, and account lifecycle behavior | Supabase Auth is the identity provider; Cloudflare Worker/API boundary validates sessions and maps stable auth subject to IFund profile/roles. Implement password login, email one-time-code account recovery, session refresh/revocation, registration, verification, role/owner claims, OAuth consent, device authorization, and account deletion. Super-admin identity must be server-verified, never inferred from frontend state. | **IN PROGRESS / Base44-dependent.** Login currently calls the same-origin Base44 auth endpoint; forgot/reset password still call Base44 SDK methods. Supabase auth cutover is not implemented or verified. |
| Database entities and permissions | All 95 current `base44/entities/*.jsonc` definitions, their IDs/relationships/validation, entity-specific permissions, existing production records, audit trails, and the financial ledger invariants | Create a complete Supabase schema and migration sequence, table-by-table RLS, constraints/indexes/foreign keys, private operational schemas, and explicit service-role-only operations. Preserve stable IDs and reconcile data before writes. Separate user-owned, campaign-owned, admin-only, financial, credential metadata, and agent/workflow state. | **INVENTORY / NOT MIGRATED.** The current source tree contains 95 entity definitions but only one Supabase migration file, documenting the initial private workflow queue. No complete replacement schema or record parity is established. |
| Backend functions | All 184 current Base44 function entrypoints, input/output contracts, validation, authorization, idempotency, provider behavior, audit semantics, and current page consumers | Inventory and map every function to a real Supabase Edge Function or Cloudflare Worker service. Preserve contracts where practical; implement typed adapters and domain services. Add authorization, request validation, safe errors, idempotency, concurrency controls, observability, and end-to-end contract tests. No generic success responses, no 503 placeholders described as migrated. | **INVENTORY / PARTIAL PORTS.** Base44 functions remain the operational source. Cloudflare gateway currently proxies Base44 for some functions/MCP; workflows and workforce endpoints are disabled. |
| AI agents and workflows | Ten agent JSONC definitions (including the separate admin builder), 26 staged skill/guide files, 17 workflow definitions, agent memory boundaries, tool allowlists, cross-agent delegation, approvals, OBO permissions, and existing AgentDelegation/AgentActivity records | Build a real independent workforce runtime. Chief of Staff is the only general executive conversation entrypoint; Support remains available as a separate support channel. Specialists retain their defined responsibilities and operate behind the scenes through structured delegation. The super_admin builder is an owner-only executive coding chief of staff with repository context, task planning, code edits, branch/PR creation, test/build execution, repair loops, and evidence reporting. It must use scoped credentials and audited tools, request approval for consequential production actions, and never claim queueing equals implementation. Build durable workflow execution with event/schedule triggers, timezone fidelity, queue state, step transitions, retries, idempotency, dead-letter/replay, and audit. | **SOURCE PRESERVED / EXECUTION NOT MIGRATED.** Existing Cloudflare workforce is a byte-exact snapshot and catalog/readiness endpoint; action execution returns 503. Workflow Worker is catalog-only, returns 503 for execution, and scheduled execution is a no-op. PR #545 is valuable staging groundwork, not a running runtime. |
| External integrations and credentials | Existing provider registry, 81 previously inventoried connector types, user-owned connections, OAuth/OBO consent, provider-specific scopes, revocation, PayPal flows, webhooks, external sync, and platform-owned account references | Implement provider adapters behind the independent API. Store only opaque credential references and connection metadata in ordinary tables. Encrypt user tokens with an application-layer key held only in Worker secrets (or a separately verified managed vault); agents receive redacted capability/state, never raw secrets. Implement OAuth callback/state/PKCE, refresh/revoke, webhook signature validation, replay protection, provider-specific scopes, and live health checks. Keep PayPal as the donation/subscription/withdrawal rail; do not introduce Stripe as a replacement. | **PARTIAL / PROVIDER-DEPENDENT.** Existing connection and OAuth implementations are substantial, but most remain Base44-backed. Credentials and provider permissions require per-provider live verification; source presence is not a connected provider. |
| Media storage and uploads | Existing image URLs, original uploads, generated campaign art, watermark/entitlement rules, upload validation, image editor behavior, focal points, aspect ratios, responsive source sets, WebP, blur-up, GIF animation, SVG behavior, and error fallback | Use the already-activated Cloudflare R2 as the independent object store. Migrate originals without destructive recompression; maintain an asset-ID/URL mapping and metadata. Build a verified image delivery/derivative path that preserves responsive DPR, crop/focal-point behavior, quality, format handling, GIF animation, SVG vectors, and watermark entitlements. Migrate existing media references before removing Base44/Wix hosts. | **PARTIAL / LEGACY CDN-DEPENDENT.** R2 is available, but the current image component still transforms Base44/Wix media URLs. Full asset migration and equivalent delivery are not verified. |
| Deployment and build configuration | Existing Vite/React/Capacitor builds, Cloudflare Workers/Pages configuration, custom-domain routing, Android build, Node 22 release baseline, CI quality/security checks, preview deployments, DNS, rollback, and cost limits | Deploy independently in coherent batches. Separate frontend and service releases; use versioned API contracts and backward-compatible routes during transitions. Remove Base44 build variables/proxies only after their consumers have migrated. Verify Supabase project, migrations, Worker bindings/secrets, R2 bindings, DNS/routes, web build, APK, and production smoke tests. Preserve exact-head quality gates; never weaken tests to make a migration pass. | **PARTIAL / NOT INDEPENDENT.** Cloudflare deployment files and Workers exist, but the gateway documentation still identifies Base44 as the data plane and the deployment workflow still contains Base44 configuration requirements. No complete independent production cutover is proven. |

### Agent-by-agent continuity

Preserve the current role definitions and skills; do not flatten specialists into generic agents or expose every specialist as a separate user-facing chat.

- **Chief of Staff:** executive orchestrator, user-facing task intake, persistent context, structured delegation, progress tracking, acceptance review, and escalation.
- **Strategy:** grant strategy, institutional opportunities, applications, and recommendations; humans retain award/approval authority.
- **Growth:** campaign growth, donor/conversion analysis, and verified recommendations.
- **Communications:** inbox, member communications, notifications, and approved outbound messaging.
- **Story:** campaign narratives, donor-facing writing, and creative content.
- **Finance:** read/analysis/reconciliation within strict finance permissions; never independently authorizes transfers or withdrawals.
- **Outreach:** creator-approved outreach and campaign distribution, respecting consent, provider limits, and approval gates.
- **Discovery / Connection Discovery:** provider capability research and verified connection-method discovery; no fabricated provider support.
- **Managed Connections:** setup/resume/health work bounded by user consent, entitlement, and provider-confirmed permissions.
- **Super-admin Builder (separate owner-only role):** full coding/build/review/repair executive assistant. The current `admin_builder_agent` is only a coordinator that queues work; it does not edit files, execute builds, or deploy. Those capabilities must be implemented as secured backend tools before this agent can be called a functioning builder.

Agent acceptance requires a real authenticated run, allowed-tool execution, scoped memory continuity, a delegation round-trip, correct denial of unauthorized tools, audit evidence, and a recovery/retry test. For the builder, also require an actual non-production code task through edit -> tests -> build -> reviewable commit/PR -> status report. Production deployment remains approval-gated.

### Execution sequence

1. **Preserve and reconcile existing work.** Keep current PRs and canonical workstreams. PR #545's workflow/agent staging is retained as an input. Existing mail, OAuth, connection, auth-hardening, security, and deployment PRs must be inspected and selectively carried forward; do not wholesale merge stale branches.
2. **Identity and authorization foundation.** Implement Supabase identity, password sessions, email-code recovery, profile/role mapping, RLS identity helpers, server-side super-admin verification, and account recovery tests. Do not expose protected pages before the authorization boundary is working.
3. **Database and API foundation.** Map all 95 entities and 184 functions to target tables/services; create additive migrations and per-table RLS; establish typed API contracts, audit/idempotency, and a record-preserving migration/reconciliation path.
4. **Agent and workflow foundation.** Implement Chief of Staff, specialist delegation, the owner-only coding builder, scoped memory, tool permissions, and durable workflow execution. Verify each agent and workflow independently before enabling it.
5. **Integrations and media foundation.** Migrate OAuth/connection credential paths and R2 media delivery with live provider and image-quality tests. Do not activate a provider without verified authorization.
6. **Deployment foundation.** Prove independent preview deployment, API routing, secrets/bindings, Supabase migrations, R2, Node 22 build, Android build, rollback, and production smoke tests.
7. **Pages, one at a time.** Start with Register/Login/Forgot Password/Reset Password and the super-admin builder access surface after the foundations above are ready. Then work through the 57 existing page components in the current route inventory, preserving route names and feature presentations. Each page gets its own completion record and release batch. Shared components/services are completed once and reused.
8. **Incremental production releases.** Push each coherent, verified batch. Temporary page/API incompatibility during planned transitions is acceptable only when the release plan identifies affected routes, preserves data, provides a rollback path, and does not expose an insecure or misleading interface. Do not perform a single all-platform cutover before all required capabilities are ready.

### Page/agent completion record

For each page or agent, maintain: source route/definition; feature description and promised behaviors; dependencies; existing prior work/PRs; functions and entities used; auth/permission matrix; UI states and responsive behavior; integration/asset dependencies; automated tests; end-to-end evidence; production release/rollback reference; and exact remaining tasks.

Use only these states:
- `inventory_only`
- `implemented_unverified`
- `verified_parity`
- `cutover_ready`
- `blocked_external_dependency`

Do not mark a page complete until all advertised actions work end-to-end on the independent runtime, unauthorized access is denied, errors/retries are safe, accessibility/mobile behavior is preserved, and the production smoke test passes. A temporarily disconnected page is not complete merely because its route is hidden or its button is disabled.
