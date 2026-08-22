# Interplanetary Fund — Canonical Sources of Truth

**Status:** Active project governance
**Effective:** 2026-08-22

## Production ownership

- **This repository (`interplanetarysister/interplanetary-fund2`) is the canonical user-facing application.**
- **Authoritative backend / agent runtime:** `interplanetarysister/InterplanetaryFund`
- **Legacy backend:** `interplanetarysister/interplanetary-fund-backend` — reference/audit only.
- **Historical application:** `interplanetarysister/interplanetary-fund` — reference/audit only.
- **Historical Base44 snapshot:** `interplanetarysister/interplanetaryfund-base44` — reference/audit only.
- **Retiring FundForge snapshot:** `interplanetarysister/fundforge-ai` — historical source only; unique capabilities are preserved in PR #50 for review before deletion.

## Rules

1. All production UI/application changes belong here.
2. Backend, Convex data, agent runtime, persistent memory, protocol, treasury, payments, and scheduled intelligence belong in `interplanetarysister/InterplanetaryFund`.
3. Never merge a PR across repositories. A change must merge into the `main` branch of the repository that owns it.
4. Search all associated repositories before declaring a capability missing or obsolete.
5. Do not promote historical code directly; classify, modernize, test, review, and audit it first.
6. Use the established backend bridge for authoritative agent memory and persistent backend state.

## Historical recovery

FundForge/Kindred names and implementation files retained under `docs/legacy/` are historical evidence only. They do not supersede the current Interplanetary Fund architecture or branding.

## Deletion safety

No historical repository is considered safe to delete until unique features, rules, agent behavior, schemas, payment behavior, integrations, deployment references, configuration dependencies, and operational documentation have been migrated, mapped, intentionally retired, or preserved as historical specification.
