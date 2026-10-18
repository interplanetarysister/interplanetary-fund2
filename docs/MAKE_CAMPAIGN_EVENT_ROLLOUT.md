# IFund → Make campaign automation rollout

The campaign-save handler emits an event only for **active, explicitly outreach-enabled, non-paused** campaigns. Event fields exclude donors, financial records and private campaign drafts. Delivery failures are logged without interrupting saving.

## Server secrets
Set in the authoritative Base44 deployment (never in client code):
- `IFUND_MAKE_WEBHOOK_URL`: URL from Make scenario 6679304. Treat the URL as confidential.
- `IFUND_MAKE_WEBHOOK_SECRET`: random secret with at least 32 characters, shared solely with a verification component in the Make pipeline.

## Receiving contract
The raw POST body is signed as lowercase hexadecimal HMAC-SHA256 over `timestamp + "." + rawBody`; headers `X-IFund-Timestamp` and `X-IFund-Signature: sha256=<hex>`. Verify against the **original raw payload** with constant-time comparison and reject timestamps outside a 5-minute window. A generic Make Webhook does not automatically verify these signatures. Until an authenticated verifier is installed, **do not activate** scenario 6679304 or populate the server destination variable.

Only after signature verification:
1. Enforce schema version 1 and allowlist event types `campaign.created` and `campaign.updated`.
2. Check user authorization and current campaign outreach consent on the server again before any social-media action. A signed event alone is not publishing permission.
3. Use Make data store 176577 for idempotency, keyed by `event_id` (and a content-version dedupe policy before cross-posting).
4. Generate truthful campaign-specific text. No fabricated fundraising outcomes, urgency, beneficiary quotes, or donation totals.
5. Publish only to separately authorized, connected account(s), honoring each platform's scope, cadence, campaign opt-out and member-specific authorization.
6. Write provider message IDs, successes and failures back through an appropriately scoped IFund endpoint. Do not misuse read-only agent API keys.
7. Test the entire pipeline in a dedicated test account, then activate.

## State
Make scenario 6679304 currently has webhook and acknowledgment modules only and is **inactive**. Its acknowledgment explicitly states no processing or publishing. No social accounts or AI credentials have been established through this scenario. This branch adds the IFund emitter but does not deploy it.

## Verification checklist
- Missing/invalid signing configuration causes no network delivery.
- Private, draft, paused or non-outreach-enabled campaigns are skipped.
- Verify correct signature, altered body failure, timestamp replay rejection.
- Verify duplicates do not republish, failed posts are logged, opt-out immediately blocks publishing.
- Validate server secret configuration and deploy both systems.
