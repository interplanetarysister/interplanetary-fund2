# Interplanetary Fund custody and holding-account contract

Interplanetary Fund is designed to present one platform balance while preserving exact beneficial ownership underneath it.

## Financial states

1. **External observed** — money reported by a connected crowdfunding/provider account. This is informational and is not Interplanetary Fund-held or withdrawable.
2. **Transfer pending** — an external provider has initiated movement toward an Interplanetary Fund-controlled settlement account, but receipt is not yet independently confirmed.
3. **Held / settled** — the payment processor or bank has independently confirmed that Interplanetary Fund controls the money. Only this state may increase held and withdrawable balances.
4. **Reserved** — settled money has been locked to a withdrawal and cannot be spent or withdrawn twice.
5. **Paid** — the withdrawal provider confirms payout to the beneficiary.
6. **Reversed / failed** — a transfer or payment did not settle or was reversed; balances must be reconciled without manufacturing value.

## Ledger allocation

Every settled movement must retain:

- stable idempotency / canonical operation identity;
- source provider and provider transaction/settlement reference;
- campaign id;
- beneficiary user id;
- amount and ISO currency;
- platform contribution and processor fee;
- withdrawal id when applicable;
- external connection/observation linkage when the money originated outside Interplanetary Fund;
- settlement timestamp and reconciliation state.

A pooled physical account does **not** mean pooled ownership. The sum of campaign/user liabilities plus platform-owned amounts must reconcile to the verified funds actually controlled by Interplanetary Fund, by currency. Money belonging to one campaign/user must never satisfy another campaign/user withdrawal.

## External-platform rule

Syncing or observing a GoFundMe, Ko-fi, Kickstarter, Indiegogo, GiveSendGo, FundRazr, Patreon, Buy Me a Coffee, or other external balance does not move money. An external balance becomes held only after that provider (or the receiving processor/bank) supplies verifiable settlement evidence into an Interplanetary Fund-controlled account. Where a provider does not support programmatic transfer, the platform must report the balance as external/pending rather than pretending it was moved.

## Access boundary

Custody ledgers, treasury snapshots, provider references, and platform-wide balances are admin-only. User-facing balance endpoints may expose only the authenticated user's/campaign's allocated balance and sanitized transaction history.

## Invariant

**Physical funds held >= total user/campaign liabilities + reserved liabilities, per currency**, after accounting for processor fees, platform contributions, completed payouts, reversals, and legally permitted platform fees. Any reconciliation failure must fail closed: block new withdrawals for the affected funds until resolved.
