# Financial Contract Reconciliation

Status: BLOCKED pending authoritative decision and cross-surface alignment.

## Evidence

- The current `main` branch file `base44/shared/fees.js` declares `PLATFORM_FEE_RATE = 0.03` and documents a 3% payout deduction.
- PR #143's fraud/withdrawal workflow and its verifier claim a 7% platform fee contract.
- These are conflicting financial contracts. Neither static CI nor the PR description is sufficient to choose between them.

## Safety rule

Do not promote or merge the withdrawal workflow until the canonical fee policy is explicitly reconciled across:

1. shared fee helpers,
2. withdrawal/payout calculations,
3. ledger and transaction records,
4. UI projections and donor-facing breakdowns,
5. backend schema/status contracts,
6. Development runtime evidence.

If the approved policy is 7%, update every canonical fee source and its tests atomically. If the approved policy is 3%, update the workflow/verifier and documentation atomically. Do not create a mixed 3%/7% deployment.

## Evidence classification

This document is static source evidence only. It is not Development runtime proof, Production reconciliation, or merge approval.
