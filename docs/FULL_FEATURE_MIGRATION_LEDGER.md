# Canonical Platform Capability & Migration Ledger

Effective: 2026-09-09

`interplanetary-fund2` is the authoritative Base44-hosted application and the current destination for the complete Interplanetary Fund platform. This ledger is the shared source of truth for recovery, implementation, review, and verification across all historical iterations.

## Current architecture rule

Complete the whole platform in Base44 first. Vercel and Convex are **deferred infrastructure**, not abandoned product capability. Do not spend current effort implementing, deploying, repairing, or migrating Vercel/Convex runtime infrastructure. When historical Vercel/Convex code supplied a useful page, workflow, automation, integration behavior, data contract, or user/admin capability, recover the intended capability and implement a safe Base44-compatible equivalent where possible. Preserve documented contracts and provenance needed for a later Vercel/Convex phase.

Current runtime target: **Node 22**.

## Evidence rules

- Never infer live provider state, credentials, ownership, payment status, deployment state, or completion.
- Source-code presence is evidence of an implementation attempt, not runtime proof.
- Compare every candidate against exact current `interplanetary-fund2` main before changing code.
- Prefer the newer secure implementation when historical behavior conflicts with current authorization, privacy, payment-integrity, accessibility, or data-integrity requirements.
- Do not blindly copy deployment/runtime dependencies from historical repositories.
- Preserve useful behavior; do not recreate duplicates.
- Prefer zero-cost/non-metered inspection and validation paths. Do not silently consume protected credits or paid services.

## Classification vocabulary

Every discovered capability must end in one of these states:

- `PRESENT_VERIFIED` — implemented in fund2 and equivalence/runtime evidence is sufficient.
- `PRESENT_NEEDS_VERIFICATION` — implementation exists but equivalence/runtime behavior is not yet proven.
- `MISSING_SAFE_TO_IMPLEMENT` — verified requirement/capability is absent and has a safe Base44 path.
- `IN_PROGRESS` — active implementation/reconciliation exists.
- `SUPERSEDED` — intentionally replaced by a newer verified implementation.
- `DEFERRED_INFRASTRUCTURE` — Vercel/Convex infrastructure itself; retain evidence for later phase.
- `UNSAFE_REJECTED` — historical behavior must not be restored because it violates current security/integrity requirements.
- `BLOCKED` — requirement is verified but a specific dependency/decision prevents safe implementation.

No capability may disappear merely because its original implementation lived in Vercel, Convex, a legacy backend, or an obsolete repository.

## Source repositories

| Source | Current role | Recovery rule |
|---|---|---|
| `interplanetary-fund2` | authoritative Base44 application | destination and current truth |
| `InterplanetaryFund` | historical Convex/application evidence | recover product capability; defer Convex runtime |
| `interplanetaryfund1` | prior full implementation/reference | reconcile verified deltas |
| `interplanetary-fund` | prior application/reference | reconcile verified deltas |
| `interplanetaryfund-base44` | prior Base44/reference | reconcile verified deltas |
| `interplanetary-fund-backend` | legacy/backend evidence | recover required behavior/contracts without blindly duplicating runtime |
| `Admin-software` | admin/reference | recover applicable Interplanetary Fund admin UX/capabilities |
| `convex-vercel-git-44` | infrastructure/application evidence | recover useful capability; defer infrastructure |
| `codex44-agent` | private workflow/tooling | recover safe process knowledge only; never copy secrets/private material into public app |

## Canonical capability inventory

| Capability / surface | Historical evidence | Current fund2 evidence/status | Classification | Next safe action |
|---|---|---|---|---|
| Payment provider truth/status | PayPal/Stripe implementations and runtime reports | capability/onboarding work exists; inconsistent frontend analysis/status has been observed | `IN_PROGRESS` | unify every campaign, AI, connections, and admin status surface on verified provider capability; never infer availability |
| Connected financial accounts | `interplanetaryfund1/src/pages/FinancialManagement.tsx` | connection/admin entities/components exist; equivalence unproven | `PRESENT_NEEDS_VERIFICATION` | reconcile connect/revoke/campaign authorization UX |
| Count My Money / consolidation / migrate funds | prior FinancialManagement plus fund2 sync engine | `CountMyMoney`, `AccountManagement`, `Connections`, `FundMigrationDashboard`, `syncExternalFunds`, scheduled External Fund Sync | `PRESENT_NEEDS_VERIFICATION` | verify reconciliation detail, ownership boundaries, manual + scheduled behavior |
| Financial ledger | prior FinancialManagement | equivalence unproven | `PRESENT_NEEDS_VERIFICATION` | reconcile ledger UI and authoritative data source |
| AI financial automation | prior FinancialManagement | agents exist; per-campaign equivalence unproven | `PRESENT_NEEDS_VERIFICATION` | recover per-campaign controls and Base44-native execution behavior |
| Withdrawal management | prior FinancialManagement + fund2 secure withdrawal work | current withdrawal surfaces exist | `PRESENT_NEEDS_VERIFICATION` | preserve newer security rules; fill missing UX only |
| Financial audit log | prior financial UI + fund2 `AuditLog` | admin surfaces exist | `PRESENT_NEEDS_VERIFICATION` | expose only appropriately scoped owner/admin views |
| Notifications | `interplanetaryfund1/src/pages/Notifications.tsx` | current equivalence not proven | `PRESENT_NEEDS_VERIFICATION` | inventory and reconcile |
| Donors directory | `interplanetaryfund1/src/pages/Donors.tsx` | current equivalence not proven | `PRESENT_NEEDS_VERIFICATION` | verify requirement and privacy-safe implementation |
| Campaign comparison | `interplanetaryfund1/src/pages/Compare.tsx` | current equivalence not proven | `PRESENT_NEEDS_VERIFICATION` | reconcile if still product-valid |
| Platform dashboard | historical `PlatformDashboard` references | connections/admin UX exists; equivalence unproven | `PRESENT_NEEDS_VERIFICATION` | recover useful platform-management behavior |
| AI campaign wizard | historical `AICampaignWizard` references | current AI campaign flow exists; equivalence unproven | `PRESENT_NEEDS_VERIFICATION` | compare and recover missing steps without duplicating newer flow |
| Responsive/mobile layout | current published app observation | some pages cannot expose/scroll sideways content correctly | `MISSING_SAFE_TO_IMPLEMENT` | audit viewport overflow, tables/cards/nav, touch scrolling, and responsive breakpoints across all pages |
| Logo/branding propagation | approved one-ring blue/purple planet branding + current published observation | intended logo has not propagated everywhere | `MISSING_SAFE_TO_IMPLEMENT` | inventory favicon/app/header/auth/share assets and unify approved branding |
| Integration analysis truth | current platform analysis + actual Base44/GitHub connection | stale GitHub/Google OAuth findings and Convex-required analysis observed | `MISSING_SAFE_TO_IMPLEMENT` | make analysis reflect verified current connection state; mark deferred infrastructure inactive rather than falsely broken |
| Convex-derived capabilities | historical Convex implementation | infrastructure intentionally deferred | `DEFERRED_INFRASTRUCTURE` for runtime only | inventory each product capability separately and provide Base44 equivalent where safe; retain future Convex contracts |
| Vercel-derived capabilities | historical Vercel implementation | infrastructure intentionally deferred | `DEFERRED_INFRASTRUCTURE` for runtime only | inventory each product capability separately and provide Base44 equivalent where safe; retain future Vercel contracts |

## Specialized agent stages

The active Agent Team uses this ledger in this order:

1. **Completeness** — inventory all historical pages/features/workflows/automations/integrations and compare with exact fund2 main.
2. **Legacy recovery** — identify intended capability and provenance; separate product behavior from old infrastructure.
3. **Agent 1 implementation** — implement the smallest complete safe Base44-compatible delta on Node 22.
4. **Agent 2 review** — review exact head for architecture, security, authorization, privacy, payments, accessibility, dependencies, and regressions.
5. **Agent 1 repair** — correct every verified review finding and rerun available checks.
6. **Agent 3 verification** — independently verify exact-head behavior, including negative authorization, responsive/mobile, accessibility, error states, and data/payment integrity where applicable.
7. **Truth/build health** — detect placeholders, simulated/live-state assumptions, dependency/build/publish failures, navigation/scrolling/branding regressions, and stale integration analysis.
8. **Knowledge retention** — record verified reusable lessons, provenance, contracts, tests, and future-infrastructure notes in repository-owned documentation.

Paused specialist workflows should be activated only when independent recurring attention is useful; they are not substitutes for this primary sequence.

## Capability record requirements

For every new inventory item, record the capability/page/workflow name; source repository/path/issue/PR/commit when available; user/admin role and expected behavior; current fund2 evidence; classification; security/privacy/payment implications; whether historical Vercel/Convex infrastructure was involved; Base44-compatible replacement strategy; verification evidence and remaining gap; and future Vercel/Convex contract/interface notes when relevant.

## Base44 completeness gate

The Base44 phase is complete only when:

1. Every accessible historical Interplanetary Fund source has been inventoried at feature/page/workflow/automation/integration level.
2. Every verified capability is classified using this ledger; there are no silent omissions.
3. Every `MISSING_SAFE_TO_IMPLEMENT` item is implemented and independently verified, or moved to another classification with evidence.
4. Vercel/Convex **product capabilities** required by the platform have safe Base44 equivalents where feasible; only infrastructure-specific work remains deferred.
5. Public/user/admin authorization boundaries, withdrawal/payment rules, privacy, and data integrity are independently verified.
6. No UI invents connected/live/configured/deployed/payment state without evidence.
7. Node 22 build/dependency checks pass where available and Base44 publishing remains healthy.
8. Responsive/mobile behavior, navigation, scrolling, accessibility, error states, and approved branding are verified across the complete page inventory.
9. No source repository is archived/deleted solely because migration appears complete; equivalence and dependency removal must be proven first.
10. Future Convex/Vercel reimplementation has preserved capability provenance and interface/contract notes sufficient to begin a later infrastructure phase without rediscovering platform requirements.
