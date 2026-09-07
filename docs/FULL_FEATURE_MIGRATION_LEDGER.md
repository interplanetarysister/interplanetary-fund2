# Full Feature Migration Ledger

Effective: 2026-09-06

`interplanetary-fund2` is the authoritative Base44-hosted user-facing application. This ledger is evidence-driven: source presence is not proof of runtime availability, and no feature is marked complete until its application-owned behavior is reconciled into ifund2 or explicitly classified backend-owned/obsolete.

## Source repositories

| Source | Role | Migration rule |
|---|---|---|
| `interplanetary-fund2` | authoritative application | destination |
| `InterplanetaryFund` | authoritative Convex/internal runtime | preserve backend ownership; migrate/repair UI and bridge surfaces only |
| `interplanetaryfund1` | prior full implementation/reference | reconcile verified application-owned deltas |
| `interplanetary-fund` | prior application/reference | reconcile verified application-owned deltas |
| `interplanetaryfund-base44` | prior Base44/reference | reconcile verified application-owned deltas |
| `interplanetary-fund-backend` | legacy/reference | do not duplicate backend logic; recover app-owned behavior only |
| `Admin-software` | admin/reference | migrate Interplanetary Fund admin UX where still applicable |
| `convex-vercel-git-44` | infrastructure evidence | no Vercel-only migration |
| `codex44-agent` | private workflow/tooling | no secrets/private implementation copied to public app |

## Verified migration queue

| Feature | Verified source evidence | ifund2 evidence | Classification | Required action |
|---|---|---|---|---|
| Payment provider status | ifund2 PayPal/Stripe paths + reported runtime behavior | PayPal capability endpoint and onboarding status repaired | IN PROGRESS | unify all campaign/AI/connections provider status on verified capability |
| Connected financial accounts | `interplanetaryfund1/src/pages/FinancialManagement.tsx` | ifund2 has connection/admin entities and components, equivalence not yet proven | VERIFY/MIGRATE | reconcile account connect/revoke/campaign authorization UI |
| Consolidate Funds / Count My Money / Migrate Funds | `interplanetaryfund1/src/pages/FinancialManagement.tsx` has consolidation UI | VERIFIED in ifund2: `src/components/account/CountMyMoney.jsx`, `src/components/account/AccountManagement.jsx`, `src/pages/Connections.jsx`, `src/components/ops/FundMigrationDashboard.jsx`, `base44/functions/syncExternalFunds/entry.ts`, and scheduled `base44/workflows/External Fund Sync.jsonc` all use the centralized sync engine | PRESENT — VERIFY EQUIVALENCE | preserve centralized engine; compare reconciliation detail/owner UX and migrate only missing behavior |
| Financial ledger | `FinancialManagement.tsx` | equivalence not yet proven | VERIFY/MIGRATE | reconcile ledger UI and source-of-truth bridge |
| AI financial automation | `FinancialManagement.tsx` | agents exist; financial-management equivalence not proven | VERIFY/MIGRATE | reconcile per-campaign automation controls |
| Withdrawal management | `FinancialManagement.tsx` plus existing ifund2 withdrawal work | ifund2 has withdrawal surfaces | VERIFY EQUIVALENCE | retain newer secure ifund2 implementation and fill missing UX only |
| Financial audit log | `FinancialManagement.tsx` | ifund2 has `AuditLog` entity/admin surfaces | VERIFY/MIGRATE | expose appropriate owner-facing audit view without weakening permissions |
| Notifications | `interplanetaryfund1/src/pages/Notifications.tsx` | verify current ifund2 notification surfaces | VERIFY/MIGRATE | reconcile if missing/newer |
| Donors directory | `interplanetaryfund1/src/pages/Donors.tsx` | verify current ifund2 | VERIFY/MIGRATE | reconcile if product requirement still active |
| Campaign comparison | `interplanetaryfund1/src/pages/Compare.tsx` | verify current ifund2 | VERIFY/MIGRATE | reconcile if still applicable |
| Platform dashboard | prior integration docs reference `src/pages/PlatformDashboard.tsx` | verify current connections/admin UX | VERIFY/MIGRATE | reconcile external-platform dashboard behavior |
| AI campaign wizard | prior AI docs reference `src/pages/AICampaignWizard.tsx` | verify current campaign AI flow | VERIFY/MIGRATE | reconcile newer application behavior |

## Completion gate

Full consolidation is complete only when:

1. Every accessible source repository has been inventoried at feature/path level.
2. Every application-owned delta is classified and reconciled into ifund2.
3. Backend-owned state/business logic remains in its authoritative runtime and ifund2 has the required interface/bridge.
4. No UI invents connected/live/configured/deployed state without evidence.
5. Static build/lint/typecheck/regression checks pass where available without Base44 credits.
6. Base44 hosting configuration remains valid, but no credit-consuming Base44 Builder/publish action is triggered while credits are unavailable.
7. No source repository is archived/deleted until equivalence and dependency removal are verified.
