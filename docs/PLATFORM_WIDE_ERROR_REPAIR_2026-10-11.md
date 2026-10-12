# IFund platform-wide error repair workflow

## Runtime policy
IFund accepts every Node.js major version **20 or greater**, without a frozen upper bound. package.json and lockfile declare >=20; .nvmrc/.node-version and GitHub setup-node track the current Node release ("node"). No CI workflow is intentionally triggered by this document. Real upgrades still require green build and compatibility tests before deployment.

## User-visible error -> system-wide fix
1. Global script/resource errors, unhandled promises, React rendering failures, failed page views, query/mutation failures, and unexpected app startup errors report through src/lib/platformErrorReporter.js. A swallowed error that is not surfaced through these integration points still needs explicit instrumentation.
2. base44/functions/managePlatformIncidents/entry.ts groups untrusted diagnostic reports, redacts details and stores reviewable PlatformIncident records. Reports do not contain raw stack traces, passwords, access tokens, account IDs, or request bodies. Grouped events are never proof of root cause.
3. Server records start with a provisional platform-wide scope, regression/verification checklist and rollback plan. The super-admin investigates the actual shared root cause and saves a more precise correction plan.
4. Admin chat -> Admin tools -> Platform errors and fix plans offers frontend review, edit, save, approve/dispatch and reject. The Admin Builder chat tool can list/save/approve a specific incident after explicit super-admin instruction. Every privileged backend call validates the signed-in super-admin account.
5. Approval creates a tracked AgentDelegation assigned to admin_builder_agent and attempts to dispatch a native Base44 builder conversation. A failed dispatch leaves the task queued and records the issue. Duplicate approval does not create another task in the sequential path.
6. **Critical remaining executor boundary:** the current admin_builder_agent can read/queue/triage, but has no authorized file edit, test, deployment or rollback tools. Native conversation dispatch is not code implementation. A separate super-admin-authorized builder executor with repository allowlisting, diff review, build/test gates and release verification is needed before fully automatic approved fixes can be claimed.
7. Do not mark incidents fixed or tell members a fix shipped without verified code changes, regression results and a published release. Rejected plans must not be executed.

## Primary source
- base44/entities/PlatformIncident.jsonc
- base44/functions/managePlatformIncidents/entry.ts
- src/lib/platformErrorReporter.js
- src/components/agents/PlatformFixReviewPanel.jsx
- src/components/agents/AdminDevelopmentChat.jsx
- base44/agents/admin_builder_agent.jsonc
- scripts/verify-platform-wide-repairs.mjs

## Smoke checks
npm run build; node scripts/verify-platform-wide-repairs.mjs; node scripts/verify-node22-release-contract.mjs; node scripts/test-node22-release-contract.mjs

All source tests remain distinct from live permission testing on published IFund. Verify anonymous/public reporting, non-admin rejection, super-admin approval, no duplicate builder assignment, and the exact deployment before treating the flow as production-ready.
