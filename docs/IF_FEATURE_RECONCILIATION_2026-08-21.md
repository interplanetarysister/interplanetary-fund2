# Interplanetary Fund — IF Features #0.5–#23 Reconciliation Baseline

Date: 2026-08-21
Status: Baseline audit — no feature implementation changes made by this document.

## Purpose

This document is the first evidence-based reconciliation pass required by IF Feature #0.5. It compares the recovered archived feature intent against the current `interplanetary-fund2` repository and records what is visibly present before implementation work is assigned.

This is a baseline, not a declaration that every feature is complete. A UI/file/entity proves presence of an implementation surface, not that the end-to-end behavior works.

## Repository ownership

- `interplanetary-fund2` — user-facing Base44 application.
- `InterplanetaryFund` — authoritative Convex backend / agent runtime.
- `interplanetary-fund-backend` — legacy/reference repository; no new production backend work should be added there unless explicitly directed.

The current `AGENTS.md` explicitly defines this ownership model and says the Convex backend is the source of truth for persistent agent identity, memory, outcomes, campaigns, protocol, treasury, payments, and scheduled intelligence. Base44 mirrors selected state and provides the user-facing application/conversation layer.

## Status vocabulary

- 🟢 Implemented surface — evidence exists; end-to-end correctness still requires verification.
- 🟡 Partial — meaningful pieces exist but the feature's definition of done is not established.
- 🔵 Refinement required — implementation exists but the archived specification requires stronger behavior/UX/integration.
- 🟠 Broken/incorrect — evidence indicates a known defect or unsafe/inaccurate behavior.
- 🔴 Missing — no meaningful implementation evidence found in this pass.
- ⚪ Deferred — intentionally set aside; do not build unless reactivated.
- ⚫ Superseded — older direction replaced by later approved architecture.

## Initial feature map

| Feature | Archived intent | Evidence found in `interplanetary-fund2` | Baseline status | Next audit focus |
|---|---|---|---|---|
| #0.5 | Reconciliation/implementation control process | `AGENTS.md`, docs, existing issues, architecture files | 🟢 Process defined | Complete feature-by-feature evidence matrix |
| #1 | Social Integration Engine / real multi-platform publishing | Connections page, platform catalog, PlatformConnection, socialPublish, broadcastPosts, publishPost, distribution UI | 🟡 Partial | Prove real OAuth, provider permissions, token handling, publishing, retries, status, E2E |
| #2 | External crowdfunding integrations | Platform catalog/connection infrastructure, onboarding references, FundMigrationDashboard | 🟡 Partial | Verify actual provider APIs/permissions and distinguish real vs coming-soon capabilities |
| #3 | AI Outreach / donor, sponsor, partner opportunity discovery | Opportunity entity, Outreach Agent panel, runOutreachAgent, opportunity-related UI | 🟡 Partial | Verify research, matching, consent, execution, auditability, privacy |
| #4 | Universal Identity Graph | Agent identity/runtime mapping and platform standards exist; no conclusive full graph implementation established in this pass | 🟡 Partial / needs deeper audit | Locate authoritative identity/relationship/authorization model in Convex and Base44; verify graph queries, delegation, duplicate protection, audit |
| #5 | Unified Communication Hub | Communication UI/functionality, Message entity, communication agents/functions, connection infrastructure | 🟡 Partial / 🔵 refinement | Verify inbox, inbound/outbound channels, permissions, delivery truth, audit trail, automation, AI execution |
| #6 | Campaign Operating System | Campaign entity, Campaign Protocol, CampaignDetail/CreateCampaign/Campaign AI, funding, analytics, updates, tasks/outreach surfaces | 🟡 Partial | Map every Campaign OS requirement to actual implementation and runtime behavior |
| #7 | Community OS + Institution OS | Community pages/components/entities/functions; Institutions page/components/entity; volunteer functionality | 🟡 Partial | Verify roles, memberships, moderation, institution permissions, partnerships, analytics, mobile, shared Identity Graph |
| #8 | AI Campaign Story & Donor Optimization | AIStoryGenerator, campaignAI, AICoach, campaign content surfaces | 🟡 Partial / 🔵 refinement | Verify fact locking, voice, audience adaptation, approvals, versioning, performance learning, truth protection |
| #9 | Trust, Verification & Transparency + research-backed budgeting + capable specialist agents | Agent system, Finance/Trust-related infrastructure, CampaignHealth, intelligence functions, budget-related agent architecture | 🟡 Partial / 🔵 refinement | Verify actual research, sources, numerical integrity, trust evidence, agent tools, execution, approvals, audit |
| #10 | Platform Foundation + 10-OS architecture | Platform page, blueprint, constitution, standards, service health, agent runtime unification, event/infrastructure files | 🟡 Partial | Verify shared event bus, authorization, jobs, idempotency, observability, environment separation, cross-OS contracts |
| #11 | Mission Control — Full Intelligence Layer | generateIntelligence, mission/opportunity panels, OpsCenter, agent runtime | 🟡 Partial / 🔵 refinement | Verify observe→understand→prioritize→recommend→execute→verify→learn loop and real command execution |
| #12 | Campaign Coach — campaign-facing expert operator | AICoach and campaign AI surfaces, campaignAI, agent infrastructure | 🟡 Partial / 🔵 refinement | Verify campaign-specific memory/context, delegation, action execution, research, undo, audit, mobile UX |
| #13 | Creative Agent / campaign visual asset system | Creative/image generation surfaces, coverPrompt, asset-related campaign UI; videos explicitly deferred | 🟡 Partial | Verify image generation/editing, campaign fact locking, asset library/versioning, preflight, accessibility; preserve video deferral |
| #14 | Automated Campaign Opportunity Detection & Intelligence | Opportunity entity, OpportunitiesPanel, outreach agent, intelligence functions | 🟡 Partial | Verify source research, freshness, qualification, scoring, watch/alerts, execution, learning, privacy |
| #15 | First-Success Guided Onboarding & Intelligent Setup | Onboarding page/steps, ConnectStep, AutomateStep, EngineStep, CompleteStep, onboarding state references | 🟡 Partial / 🔵 refinement | Verify adaptive paths, first-success checklist, persistence, research, intelligent defaults, child-simple UX |
| #16 | User Profile / Preferences / Personal Context Foundation | Profile page, onboarding/profile components, user schema/history, permission/agent context references | 🟡 Partial / 🟠 known schema risk | Verify profile/onboarding/preferences persistence and frontend/backend/entity schema synchronization |
| #17 | Automated Communication & Notification Intelligence | Notification/communication surfaces, communication functions, Message entity, agent/runtime, event infrastructure | 🟡 Partial / 🔵 refinement | Verify event routing, grouping, briefings, rules, authorized sending, delivery truth, preference enforcement |
| #18 | Distribution / Multi-Platform Publishing | DistributionPanel, generateDistributionContent, publish/broadcast functions, connections, socialPublish | 🟡 Partial | Verify real provider execution, scheduling, retries, duplicate prevention, attribution, approvals, no fake states |
| #19 | Analytics / Intelligence / Campaign Performance | Analytics page, CampaignPerformance, ReportsPanel, AlertCenter, intelligence functions | 🟡 Partial / 🔵 refinement | Verify real data lineage, calculations, forecasts, source transparency, agent analytics execution, simple UX |
| #20 | Premium / Subscription AI Capabilities | Subscription plans, subscription functions/infrastructure, agent/automation surfaces | 🟡 Partial | Verify entitlements, premium capacity, monitoring, safe shutdown, spending limits, billing truth, no surprise charges |
| #21 | Help / Guidance / User Assistance | Help page exists in the wider platform lineage; current repository needs behavior-level verification | 🟡 Partial / needs deeper audit | Verify contextual help, diagnostics, safe fixes, current-state awareness, escalation, no fake functionality |
| #22 | Trust, Verification & Safety Intelligence | Trust/health/security/verification-related surfaces and agent architecture | 🟡 Partial | Full trust evidence, verification lifecycle, human review, appeals, suspicious activity, privacy/security audit |
| #23 | Community & Supporter Network | Community page/detail, Community entity/member entity, discussions, volunteer, posts, follow/campaign relationships | 🟡 Partial | Verify supporter lifecycle, campaign communities, events, moderation, discovery, privacy, AI execution, analytics |

## Evidence already confirmed

### Application architecture
`interplanetary-fund2` contains a real application source tree, Base44 entities/functions, documentation, agent configuration, onboarding, campaign, community, institution, analytics, connection, distribution, and platform modules.

### Campaign system
Confirmed implementation surfaces include `Campaign.jsonc`, Campaign Protocol, CreateCampaign, CampaignDetail, CampaignCard, CampaignHealth, CampaignFundingCard, CampaignPerformance, AI Coach, AI story generation, campaign updates, outreach UI, and cross-platform totals.

### Social/distribution system
Confirmed implementation surfaces include Connections, platform catalog, PlatformConnection, socialPublish, broadcastPosts, publishPost, DistributionPanel, and distribution-content generation. This proves substantial infrastructure exists; it does not prove every provider's production OAuth/publishing flow is complete.

### Agent system
Confirmed implementation surfaces include Agent entity/configuration, specialized agent definitions, Agents page, AgentChat, agent identity mapping, AgentActivity, recordAgentInteraction, runOutreachAgent, and the documented Convex/Base44 runtime bridge.

The runtime documentation states that Convex is authoritative for agent identity, memory, outcomes and operational state; Base44 is the user-facing conversation layer; and the bridge does not itself grant new permissions or bypass human approval.

### Community / institution system
Confirmed implementation surfaces include Community and CommunityMember entities, Community page/detail, CreateCommunityDialog, discussions, posts, volunteer functionality, Institutions page, Institution entity, institution types, and organization-oriented platform architecture.

### Platform foundation
Confirmed implementation surfaces include Platform page, blueprint, constitution, standards, ServiceHealthPanel, intelligence generation, and runtime-unification documentation.

### Existing audit evidence
The authoritative Convex repository contains an `AUDIT_REPORT.md` dated 2026-08-07 stating that the fundforge reference architecture had been integrated and that the IF repository had 33 pages and 26 components at that point. That report is historical evidence of prior work, not proof that every later IF Feature requirement is complete.

## Known evidence-based issues that must remain in the reconciliation

Existing GitHub issues already document significant work that must not be lost, including:

- Issue #1: incorporate backend/repository improvements without introducing bugs.
- Issue #10: high-severity financial authorization and ledger-integrity findings, including donation field protection, campaign financial counters, subscription price/tier binding, and webhook idempotency.
- Issue #11: high-severity Message audit-record authorization finding.
- Issue #13: human-use findings that agents are too restricted, need real action capability, need stronger domain expertise, and need simpler user-facing answers; also notes social/API configuration and branding/media issues.
- Issue #14: human-use findings around popups, globe rendering, inbox delivery, campaign posts, and external-platform interaction visibility.
- Issue #16: missing/unimplemented code audit and implementation request.
- Issue #17: review/commit workflow requirements for approved builds across live platform repositories.
- Issue #19: child-simple UX and signature branding/media requirements; explicitly says no videos for now.

These issues should be reconciled into feature implementation references instead of duplicated blindly.

## Important repository issue-number correction

The current repository's **Issue/PR #5 is a closed Dependabot pull request**, not the IF Features archive handoff issue. It must not be repurposed as the feature archive implementation issue merely because an earlier conversation referred to "#5." Any feature-archive implementation work should use the correct existing issue or a new dedicated issue.

## Architectural guardrails

1. Do not rebuild working systems merely because the archived rough draft describes them.
2. Do not call a feature complete because a page, button, entity, or placeholder exists.
3. Do not call an integration functional until the real provider/API workflow is verified.
4. Keep Convex as the authoritative backend/agent runtime where `AGENTS.md` says it is authoritative.
5. Do not create competing local agent-memory or production backend systems.
6. Keep video generation deferred unless the user explicitly reactivates it.
7. Keep the child-simple frontend rule across every feature.
8. Use progressive disclosure for advanced capabilities.
9. Research-backed numerical claims must identify assumptions and sources; estimates must not be presented as facts.
10. Agents must execute authorized actions when the feature requires it, but never bypass permissions or approval boundaries.
11. Preserve auditability, least privilege, privacy, security, and rollback where possible.

## Initial implementation sequencing recommendation

This is a dependency-based starting point, not a final claim that every status is complete:

1. **#0.5 — reconciliation and evidence matrix**
2. **#10 — shared Platform Foundation / 10-OS contracts**
3. **#4 — Identity Graph / permissions / relationships**
4. **#16 — Profile, preferences, onboarding context, schema integrity**
5. **#1 + #2 — external integration engines**
6. **#5 + #17 — communication and notification execution**
7. **#6 — Campaign OS**
8. **#11 + #12 — Mission Control and Campaign Coach execution**
9. **#3 + #14 — opportunity discovery and intelligence**
10. **#8 + #13 — campaign optimization and creative execution**
11. **#9 + #22 — trust, verification, research-backed budgeting, safety**
12. **#18 — distribution execution**
13. **#19 — analytics/forecasting/attribution**
14. **#15 — onboarding refinements / first-success completion**
15. **#7 + #23 — community/institution/supporter ecosystem completion**
16. **#20 — premium automation/capacity hardening**
17. **#21 — contextual Help and autonomous troubleshooting**

Actual implementation order may change after the remaining repository/backend evidence is inspected.

## Next required audit pass

Before creating implementation issues, inspect the corresponding authoritative Convex files and the legacy backend for every feature, then verify:

- frontend ↔ backend ↔ entity/schema contracts;
- real provider/API behavior;
- authorization and role/resource permissions;
- agent tools and execution paths;
- automation triggers and idempotency;
- event propagation;
- tests and CI;
- production environment separation;
- security and privacy;
- mobile UX;
- existing GitHub issues/PRs;
- deferred/superseded work.

Only after that pass should individual implementation issues be finalized.
