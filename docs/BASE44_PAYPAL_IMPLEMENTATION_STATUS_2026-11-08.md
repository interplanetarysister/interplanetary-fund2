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
