# Existing-feature completion checkpoint — 2026-09-08

## Scope and source evidence

Owner instruction: begin with ifund2, finish incomplete feature code, reuse existing implementations, and remove duplicates only when removal is not harmful. Base44 remains the implementation target; no Vercel/Convex feature work is authorized.

Base: `44266fc2861597acee6ea558003ec37057b47190`.
Branch: `fix/complete-existing-feature-boundaries`.

Inspected the linked account's repository inventory, open ifund2 issues/PRs, and open issues across the other repositories. Source comparison for this slice:

| Source | Evidence | Decision |
| --- | --- | --- |
| ifund2 main | `getMyGiving` already implements owner-scoped verified history; recommendations still read Donation directly | Extend the existing function with a campaign-ID-only projection; do not create a second donation-history service |
| `interplanetaryfund-base44` at `a6e8ce6269440e531b352b868a436b6aa18499d0` | Same recommendation and inbox components retain direct browser entity mutations/reads | Historical duplicate with the same gaps; copying would not repair them |
| `interplanetary-fund` at `be7d856008fe3c48eb5793b60708b10e37743c1e` | Neither corresponding component path exists | Not an implementation source for this slice; no claim of repository-wide equivalence |
| Other repositories' open issue inventory | Includes duplicate analytics, external balances, legacy financial/security work, and superseded deployment/consolidation directions | Preserve useful requirements; no wholesale migration or deletion based on issue titles |

No byte-identical files were found within ifund2 `src/` and `base44/`. Removed redundant recommendation backfill/ranking logic and duplicate direct-mutation paths in the three inbox/notification surfaces. Source repositories were not deleted: deployment/dependency removal is not verified. Shared appearance alone does not prove deletion is safe.

## Implemented code

- #188: recommendations use the existing `getMyGiving` authorization boundary with a bounded, unique list of confirmed campaign IDs. The projection excludes other owners even for administrators and exposes no amounts or provider fields. Repeated gifts/duplicate observations no longer multiply affinity. Ranking is deterministic; anonymous and failed-personalization paths retain trending fallback. Existing campaign aggregate truth remains dependent on #177.
- #189: a single `updateInboxState` function handles saving plain-text drafts, idempotent completion, notification read, and owner-scoped bulk read. It validates allowed actions/fields, draft size, record ownership, account revocation, and state. It never sends or publishes. Direct entity updates are disabled in the two schemas; legitimate service-role writers remain in place.
- #189 UI: inbox edits now have an explicit Save draft action; failed persistence/completion/clipboard writes show retryable safe errors. Notification surfaces update their display only after server acknowledgement and share one client helper. Bulk updates expose remaining batches instead of claiming all were processed.
- #186: corrected the source-of-truth guide's stale Convex authority statements. This does not assert that deployed infrastructure changed or that existing legacy dependencies disappeared.

## Reader/writer reconciliation for #189

InboxItem browser updates exist only in InboxItemCard and now use the server function. Notification browser updates in InboxItemCard, Notifications, and NotificationBell use the same function. Recipient-filtered readers in Inbox, Notifications, NotificationBell, and account export remain readers. getAgentMailContext is an existing server reader. Server financial mirrors, payment webhooks, campaign updates, volunteer/institution flows, communication delivery, connection sync, and integration alerts write through service-role entities. Account deletion uses service-role deletion. Those business writers are preserved; this slice does not certify their wider authorization or financial integrity.

## Verification and release limits

Node 24 local behavior tests execute the actual handlers against an in-memory SDK boundary: normal user/admin owner isolation, missing/malformed records, pending/unknown exclusion, duplicate affinity, input limits, revoked accounts, idempotent completion/read, draft preservation, failure/retry, and safe errors. They do not prove hosted Base44 RLS/service-role semantics or provider state.

Local lint, typecheck, feature-boundary tests, and production build passed. Build warns that no `VITE_BASE44_APP_ID` is configured locally and about bundle size; it is compilation evidence, not a working hosted deployment. The existing quality workflow now runs the focused tests. No paid runtime, AI, deployment, or provider operation was invoked.

Before merging/publishing, verify Base44 accepts `update: false`, service-role bypass works, and existing server writers still work. Deploy the function and both schema/UI changes together through the authorized release process. Verify owner/admin/unrelated-user behavior and browser/mobile save/retry flows in that environment. Obtain independent review of this exact branch. Do not close #188/#189 based solely on local mocks.

## Remaining work and next action

This checkpoint is not completion of all repositories or the entire feature backlog.

1. Review the implementation for #188/#189 and run hosted authorization/browser verification when available; keep draft until then.
2. Continue #177/#178/#183 verified-financial-state reconciliation. `payment_verified` is an existing Boolean contract, not independent proof of cleared/reversed provider state. Campaign totals and badge thresholds still require writer/recovery proof; do not invent new payment lifecycle fields.
3. Reconcile #182 support submission with existing account guard, SupportTicket schema, and duplicate/retry prevention. Do not create a duplicate ticket system.
4. Reconcile active duplicate PR pairs (#106/#146, #107/#145, #83/#120 and account-deletion/export variants) against exact main and review findings before adopting code or deleting older paths.
5. Preserve existing Convex financial/agent bridges until Base44-equivalent behavior is verified. Implementing a replacement ledger without documented atomic claim/recovery primitives would be unsafe. No Vercel/Convex feature repair is authorized.

Hosted RLS, live payment/reversal/clearing truth, external account/provider setup, and deployment equivalence remain unverified. Continue repository/local work independently of those blockers; never claim runtime completion from source alone.
