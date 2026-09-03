# Convex Reconciliation Evidence Template

Copy this template into the PR record only after collecting the evidence from the actual target Convex deployment. Do not fill unknown values by inference.

## Review identity

- Repository: `interplanetarysister/interplanetary-fund2`
- PR: `#143`
- Source commit under review: `<exact SHA>`
- Canonical backend repository/commit: `<repo>@<exact SHA>`
- Target deployment: `<Development or Production deployment name>`
- Evidence collected at: `<UTC timestamp>`
- Collector: `<agent/person>`

## Deployment inventory

| Surface | Deployed evidence | Canonical source evidence | Classification | Notes / owner |
|---|---|---|---|---|
| Functions | `<export/link/log>` | `<path/symbol>` | `source-only` / `deployed-only` / `renamed` / `version-drift` / `UNKNOWN` | |
| Cron schedule | `<export/link/log>` | `<path/symbol>` | | |
| Schema | `<export/link/log>` | `<path/schema>` | | |
| Environment bindings | `<export/link/log>` | `<path/config>` | | |
| Deployment version | `<deployment version>` | `<source commit>` | | |

## Automation conflict reconciliation

For each named entry point, attach the deployed invocation evidence and source mapping. If a symbol cannot be found in visible source, record `UNKNOWN`; never convert that to `absent` without deployed evidence.

| Entry point | Trigger/schedule | Shared record family | Claim/lease key | Idempotency key | Fencing / expiry | Retry class | Conflict result | Recovery result |
|---|---|---|---|---|---|---|---|---|
| `runAllAgentAutomation` | | | | | | | | |
| `runCoordinatorAutomation` | | | | | | | | |
| `runScoutAutomation` | | | | | | | | |
| `checkSiteHealth` | | | | | | | | |
| `runPostProductionAutomation` | | | | | | | | |

## Development validation records

Record invocation IDs and resulting records, not only logs or screenshots.

| Scenario | Invocation IDs | Expected invariant | Observed records / provider response | Pass/fail | Notes |
|---|---|---|---|---|---|
| Concurrent automation | | One winner; no duplicate side effect | | | |
| Concurrent approve/deny | | One terminal decision | | | |
| Provider success + local finalization failure | | Retry finalization; no provider resubmission | | | |
| Non-success / unknown provider status | | Never local `paid` | | | |
| Partial reservation release | | Retryable and idempotent | | | |
| Duplicate payout/release replay | | Rejected or idempotent no-op | | | |
| Moderation authorization | | Anonymous/user denied; admin allowed; direct invocation enforced | | | |

## Promotion decision

- [ ] Deployed-versus-source reconciliation attached
- [ ] Development matrix complete with exact records
- [ ] Exact-head static CI green
- [ ] Combined Agent 2+3 audit complete for exact head
- [ ] Agent 3 publication review complete for exact head
- [ ] PR head unchanged since final audit
- [ ] Rollback and monitoring plan attached

**Decision:** `HOLD` until every checked gate has attached evidence. Never mark this template complete from static source inspection alone.
