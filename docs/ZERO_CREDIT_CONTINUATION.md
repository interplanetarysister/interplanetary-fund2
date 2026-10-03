# IFund Zero-Credit Continuation Contract

## Purpose
GitHub Actions minutes/credits are optional evidence, never a prerequisite for continuing IFund implementation. When hosted CI cannot run because credits/minutes are unavailable, work must continue through repository edits plus non-metered/local validation.

## Current continuation target
Branch: `feature/managed-connection-agent`
PR: #488

The active implementation is the Managed Connections / user-directed IFund-help work. Do not restart it from old prompts or rebuild a second connection framework.

## Canonical behavior to preserve
1. A newly created account goes to `/onboarding`.
2. The first onboarding choice explains IFund help in child-readable language.
3. There is one global, revocable IFund-help permission. User-facing text avoids OBO/OAuth/API jargon.
4. OFF means no delegated external actions; external connection/account/posting work is manual.
5. ON is standing authorization. The later button press is the command:
   - Connect -> perform eligible connection work.
   - Create account -> perform eligible external-account creation/setup.
   - Publish -> distribute to eligible connected accounts.
6. Do not ask for the same IFund permission again for each command.
7. Provider-required authentication/confirmation may still be required.
8. Finishing onboarding returns to homepage `/`.
9. Internal attribution is `principal user -> direct command or standing instruction -> user_directed_extension -> external operation`.
10. Managed Connections is available at subscription level 2+ and admin remains top-tier.
11. Reuse PlatformConnection, PlatformConnectionRecipe, AuthorizationGrant, AgentDelegation, existing connectors/browser workers and publishing flows.
12. Route knowledge is operation-specific. Failed routes are recorded; another provider-permitted candidate is selected. Only actual verified execution becomes `proven`. Never fabricate a working route.

## Work already implemented on this branch
- Managed Connection Agent definition and roster entry.
- Managed Connections entitlement and plan benefit.
- User-directed-extension fields on authorization/delegation/connection records.
- Unified OBO/IFund-help consent model.
- Simple first onboarding IFund-help screen.
- Registration routes new users to onboarding.
- Onboarding completion routes to homepage.
- Connect UI uses the standing permission rather than asking again.
- OAuth finalization reads the canonical standing permission.
- Publish UI uses a simple connected-account sharing command.
- PlatformConnectionRecipe supports discovery state, candidates, blocked routes, successful route, research sources and rediscovery.
- Recipe resolver records attempts/outcomes and returns the next untried candidate.

## Remaining implementation/verification
- Audit every offered fundraising platform and every operation actually exposed by the product.
- Populate/reconcile recipe candidates from current provider documentation and existing IFund adapters.
- Exercise routes only where the environment/account permits. Documentation-only knowledge stays researched/probation, never proven.
- Finish the external Create Account runtime/UI path so the single click invokes Managed Connections for eligible providers.
- Verify Publish sends to all eligible connected accounts when IFund help is ON and does not delegate when OFF.
- Verify toggling OFF updates existing connection execution state without deleting connections.
- Verify new-account flow end-to-end: register -> verify -> IFund help -> remaining onboarding -> homepage.
- Review mobile/web parity and simple-language copy.
- Agent 2 review; repair findings; Agent 3 independent verification.

## Zero-credit validation
Do not wait for GitHub Actions. Run these from a local checkout, Base44 shell/build environment, or another non-metered execution environment:
```
npm run typecheck
npm run lint
npm run build
npm run verify:entitlement-obo
npm run verify:connection-lifecycle
npm run verify:entitlements-connections
npm run verify:base44-sync
npm run verify:ui-regressions
npm run verify:external-fund-network
```
Run applicable focused tests after each repair. A missing hosted Actions run means `CI_UNAVAILABLE`, not PASS and not FAIL.

## Handoff rule
Before ending a work session, update this file if implementation state changed materially. The next worker must read this file plus current branch diff before making changes. Continue from current code; do not rely on an old chat transcript or stale PR description.

## Checkpoint rule
Do not call the branch validated/known-good until non-metered build/typecheck/focused checks and runtime smoke tests have actually passed. Record which environment produced the evidence.
