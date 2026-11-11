# Base44 live PayPal payments verification - 2026-11-11

This document tracks observed configuration and outstanding verification, not a claim that live payments were processed.

- `public_campaign_fundraising`, `payment_checkout_enabled`, `paypal_checkout`, and `paypal_donation_reconciliation` currently enabled.
- `outbound_payout_execution` disabled pending verified PayPal Payouts scope/merchant authorization.
- `PayPalCampaignWebhook` registry has no rows; existing `PAYPAL_WEBHOOK_ID` secret must be verified against PayPal live webhooks before turning on/confirming live readiness.
- No `PayPalOrder`, `Donation`, `HoldingLedgerEntry`, or `Withdrawal` records were returned during inspection; a real completed capture is still necessary to verify the accounting path.
- Cloudflare `ifund-payments` Worker has `IFUND_PAYMENTS_ENABLED=false`, and is distinct from Base44's direct PayPal functions.

Never mark a donation as successful solely from a checkout redirect. Only reconcile provider-verified captures into canonical and mirrored records. Never enable payouts without merchant scope and owner/withdrawal verification.
