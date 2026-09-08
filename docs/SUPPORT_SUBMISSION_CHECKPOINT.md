# Support submission — Issue #182

Base: `44266fc2861597acee6ea558003ec37057b47190`.
Branch: `fix/support-ticket-submission` (independent of PR #190).

## Existing implementation and duplication check

Current main has one SupportTicket writer, `src/pages/Help.jsx`, and one schema,
`base44/entities/SupportTicket.jsonc`. No other current reader/writer or server
submission function was found. Historical FundForge snapshots in the local
InterplanetaryFund/backend checkouts also submit directly from Help.jsx; they are
not repaired implementations to copy. The two other reference checkouts inspected
in the previous pass contain no corresponding support-submission function.

The existing Help Center and SupportTicket entity are retained. The direct browser
creation path is removed. There is no second support system or new messaging path.

## Changes

- `submitSupportTicket` uses the existing active-account guard to derive requester
  identity/contact fields. Caller identity/status fields are rejected, including
  for administrators submitting their own requests.
- Only request UUID, subject, and message are accepted. Subject is bounded to 200
  characters and message to 10,000; blank/control-only messages are rejected.
  Content stays plain text. Server responses contain only acknowledgement fields.
- SupportTicket now has explicit owner/admin read access, service-only creation,
  and admin update/delete. Existing tickets do not require a request UUID migration.
- The existing rate limiter gains an opt-in fail-closed mode without changing
  existing callers' behavior. New support attempts use a five-per-hour limit;
  sequential replays return the existing ticket before consuming another slot.
- A UUID retained by the current form instance supports retries after a lost
  response. Duplicate clicks are blocked synchronously. Successful acknowledgement
  clears the form; errors retain it. Editing creates a new intent on resubmission.
- Existing audit helper records actor/action/ticket ID without ticket content or
  contact information. It remains best-effort; this is not a durable audit outbox.

## Verification

`npm run test:support-ticket` executes the real handler and its existing shared
helpers with an in-memory SDK boundary. Cases cover missing/revoked auth,
owner/admin identity, forged fields, malformed/oversized text, replay/content
conflict, lost acknowledgement after creation, limiter outage/throttle, safe errors,
audit minimization, and compatibility of other callers' fail-open limiter behavior.
Local lint, configured typecheck, and production build passed on Node 24.

The repository's typecheck configuration is narrow (`checkJs: false` and selected
include paths); a passing command is not full static verification of the backend.
Tests do not invoke the deployed SDK or establish hosted authorization behavior.

Official schema/security references inspected on 2026-09-08:
- https://docs.base44.com/developers/backend/resources/entities/security
- https://docs.base44.com/developers/backend/resources/entities/entity-schemas

These document boolean RLS rules, owner/role conditions, and generated IDs. They do
not establish an application-level unique constraint for `request_id` here.

## Release blockers — do not close #182 or merge as production-complete

1. **Cross-worker uniqueness is unresolved.** Lookup plus create suppresses
   sequential retries but concurrent workers can create duplicates. The schema
   explicitly does not claim request_id uniqueness. A documented and verified
   durable atomic claim/unique constraint is required for full idempotency.
   Do not manufacture a passing concurrency result or delete duplicate records
   blindly. The shared limiter also does not guarantee strict distributed limits
   during bucket creation/concurrent reads.
2. **Hosted authorization and regression evidence is unavailable.** Verify
   anonymous/owner/unrelated-user/admin read/create/update behavior in Base44,
   service-role creation, old ticket access, and browser/mobile form retries.
   Deploy the new function with schema and UI together; schema-only promotion
   would disable the current direct submission flow.
3. **Review is pending.** Run exact-head CI and independent review before release.
   No paid Base44/provider operation or deployment was performed.
4. **Retry scope:** the intent is retained for the mounted form, not across reloads
   or devices. Do not advertise cross-device exactly-once submission. After an
   ambiguous failure, retry unchanged before editing or reloading.

## Continuation

PR #190's Production Quality Gates and Terms Liability Verification both passed
for `5c979791ed865a4e42c129b6c1e67dfd45919418`; hosted verification remains pending.
This support branch completes the locally verifiable authorization/UI slice of
#182, not every acceptance gate. Next: establish the Base44 atomic claim contract,
test concurrent creation and limiter behavior, then independent review and hosted
verification. Continue other repository-only feature work while those are blocked.

Issue #181 was also inspected: FeaturedCarousel queries undeclared `is_featured`
and uses campaign financial aggregates. It needs the existing moderation and #177
aggregate contracts reconciled before a safe implementation; no duplicate
featured-campaign system or speculative schema-only change was introduced.
