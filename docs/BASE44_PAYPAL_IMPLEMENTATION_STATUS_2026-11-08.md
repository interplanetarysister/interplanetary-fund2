# PayPal implementation status

This is an internal audit checkpoint, not proof of provider readiness.

- Keep real donations and payouts disabled pending provider verified acceptance tests.
- Current product rule is 7% of verified, cleared campaign gifts, deducted once at withdrawal.
- Existing source fee arithmetic, canonical ledger reservations, UI and tests must be reconciled together before payout activation.
- Existing PayPal merchant, webhooks, OAuth, idempotency and refunds require server-side verification.
