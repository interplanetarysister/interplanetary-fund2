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

## Member access and cross-host verification

The owner-requested member account completed email verification. A real Base44 session reports ordinary user role with active Enterprise entitlement; PayPal subscription options report live_configured=true, webhook_configured=true, readiness=verification_checked. These are readiness reads, not proof of checkout, renewal, cancellation or refunds.

The same account API path on interplanetaryfund.com returns 404 in Chromium (a non-browser request was separately rejected by the edge with 1010). Cross-host live sharing is NOT verified. Published registration pages also differ: the domain uses a pre-registration legal review; Base44 uses the member registration form. Do not bypass the legal review or infer shared sessions from matching branding.

Source repair: subscription failures now show retry UI instead of indefinite loading, and tab focus/visibility triggers status refresh. Homepage primary signup goes to /register. Dashboard includes an Android installation card and /download page adapted from existing PR #533; no APK binary or release was built. No verified public signed APK URL was found, so this remains browser installation only.

Walkthroughs: the existing CoachMarks popup renderer is reused globally for user@interplanetaryfund.com. Every pathname has at least three steps, existing detailed tours/tips are reused, fallback guidance covers other routes, and a navigation key restarts the tour on every visit. Existing per-page auto tours are suppressed for that account to prevent duplicate popups. It does not alter permissions, tips completion for other users, or legal gates.

Validation: Vite production build, TypeScript, changed-file ESLint, login recovery and PayPal subscription/premium-access contracts pass. Chromium mobile fixture tests pass on dashboard, subscriptions, download, discover and a dynamic campaign route, including return navigation with tips_completed=true. Fixtures do not prove production data sharing. Run scripts/test-member-page-walkthroughs.mjs against local Vite preview on port 4179; CHROMIUM_EXECUTABLE_PATH may select installed Chromium.

Reuse gate: inspected lucide-icons/lucide on GitHub (active 2026-11-11), and the installed lucide-react LICENSE (ISC, with Feather MIT portions). Reused existing pinned icons and coach renderer with no added dependency or external service/cost. No new package security surface introduced. Existing download implementation was recovered from PR #533 rather than duplicated. Rollback is a commit revert. Production release and backend route reconciliation remain blocked/unverified under the zero-credit policy and current hosting mismatch.
