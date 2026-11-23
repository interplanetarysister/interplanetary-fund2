# PayPal implementation status

This is an internal audit checkpoint, not proof of provider readiness.

- Keep real donations and payouts disabled pending provider verified acceptance tests.
- Current product rule is 7% of verified, cleared campaign gifts, deducted once at withdrawal.
- Existing source fee arithmetic, canonical ledger reservations, UI and tests must be reconciled together before payout activation.
- Existing PayPal merchant, webhooks, OAuth, idempotency and refunds require server-side verification.

## Sandbox demonstration path (2026-11-10)

Live fundraising, checkout and payouts remain disabled. A separate, default-off sandbox path was added so the checkout flow can be demonstrated without real money.

Design rules:
- Sandbox and live are partitioned by an `environment` field on `FinancialOperation`, `Donation`, `HoldingLedgerEntry` and `PayPalOrder`. Sandbox rows are excluded from campaign totals, the owner ledger, platform analytics, withdrawal balances and payouts.
- `payPalCampaignWebhook` resolves its environment server-side, verifies signatures only against the environment-matched webhook ID, and releases no money before signature checks succeed.
- A PayPal capture is only accepted for an order this app created and persisted first; amount, currency and `custom_id` are compared against the stored order.
- Refunds and reversals cancel the canonical operation, un-verify the donation mirror, reverse the custody entry and recompute totals.

Verified this session:
- Build and all 10 release gates pass.
- `createPayPalOrder` fails closed with 409 while fundraising is paused; no order is written.
- `payPalCampaignWebhook` GET reports `ready: true, financial_actions: false`.
- A forged capture POST is rejected with 503 and produced zero `WebhookEvent` and zero `FinancialOperation` rows.
- `PayPalOrder` request keys are unique; a repeated create keeps one row and updates in place.
- `paypalSandboxReadiness` reports credentials and webhook ID missing, flag off, all six entities present.

Still blocked (needs provider credentials, not code):
- A real sandbox order → approval → capture → webhook completion has not been executed.
- `PAYPAL_SANDBOX_CLIENT_ID`, `PAYPAL_SANDBOX_CLIENT_SECRET` and `PAYPAL_SANDBOX_WEBHOOK_ID` are not set, and the `paypal_sandbox_demo` flag is off.
- Capture-side rejection of a sandbox order not created by this app is therefore unexercised.

## Owner-ledger reporting repair

The owner ledger previously swallowed failed financial/custody/campaign reads and returned successful empty history. The repair propagates failures to its existing safe 500 response, rejects truncated campaign metadata, and excludes explicit sandbox operations and custody entries from live history and counts. No payment gates, provider credentials, payout paths, authentication controls, or entitlement checks were changed.

Verification: `node scripts/verify-owner-financial-ledger.mjs` executes isolated handler stubs for each failed read, malformed results, mixed sandbox/live history and campaign truncation. It passes. Fee, Stripe idempotency and 67 financial integrity static checks pass. The aggregate payment suite is blocked by an existing assertion looking for `const order = await createOrder` although main now uses `let order; order = await createOrder`; this is not evidence of live payment readiness.

Reuse discovery: inspected MIT-licensed https://github.com/Ai-Automators/base44-to-supabase-sdk (last pushed 2025-08-14). Rejected: replaces the authoritative data plane, adds migration/privacy/dependency risk and cannot fix this handler's error handling. No dependency/service added; security/dependency audit is unnecessary for an unadopted package. Chose the small existing-handler repair, with no new cost or runtime dependency. Rollback: revert the repair commit.

Account access evidence: the approved invitation for user@interplanetaryfund.com already carries enterprise/active/admin-provider entitlement with ordinary user role. It has not joined the app, so no registered User row exists. The requested password login returned HTTP 400 without a session; password configuration and first sign-in remain unverified. Never store the requested password in source or grant administrator privileges to solve membership access.

Remaining release blockers: direct sandbox edits require Base44 Builder plan; metered operations remain constrained by the zero-credit directive; provider sandbox credentials and live acceptance evidence remain unavailable. This repair has local deterministic proof only and is not claimed deployed. Live payments, currency reconciliation, withdrawal reservation accounting, provider trace reconciliation, frontend connection end-to-end verification and website remakes remain incomplete.
