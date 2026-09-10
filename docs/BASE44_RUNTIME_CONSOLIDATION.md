# Base44 Runtime Consolidation

Branch: `base44-runtime-consolidation`
Status: implementation branch; **not main**
Date: 2026-09-09

This record prevents duplicate reconstruction while formerly Convex/Vercel-backed behavior is adapted to the current Base44-only phase.

## Implemented on this branch

- Added admin-only `FinancialOperation` entity as the Base44-native idempotent server ledger for confirmed/pending donations, external observations, withdrawal reservations, completion and cancellation.
- Reimplemented the existing financial compatibility module (`base44/shared/convexFinancial.ts`) so all current callers use Base44 entities/functions and no longer require Convex endpoints/tokens. Filename intentionally remains as a compatibility shim until a separately verified import rename.
- Preserved pending-manual-donation behavior: pending records do not count as raised/withdrawable; an authorized verification can promote the same idempotent operation to confirmed rather than create a duplicate.
- Preserved withdrawal double-spend accounting through server-side reservation operations plus the existing Donation mirror locks. Completed reservations remain committed; cancelled reservations release canonical availability.
- Reimplemented `recordAgentInteraction` to persist authorized interaction history in Base44 `AgentActivity` instead of the hard-coded Convex mutation endpoint.
- Reimplemented the existing `syncFromConvex` compatibility endpoint as Base44-native Ops Center refresh. It no longer contacts Convex and explicitly refuses to infer payment availability.
- Removed the obsolete scheduled `Convex Sync` workflow. Native Base44 state does not need a 30-minute external mirror, and removing it avoids unnecessary metered workflow executions.
- Updated repository source-of-truth documentation to make current Base44 runtime independence explicit.
- Corrected `.node-version`, `.nvmrc`, `package.json` engine, and `@types/node` intent from Node 24 to Node 22 on this branch.

## Existing features now routed through the Base44 financial authority

Because their existing functions import the compatibility financial module, the following paths now use the Base44-native ledger without duplicating their feature implementations: Stripe webhook donation recording, PayPal order/capture donation recording, manual donation recording/verification, Ko-fi external observations, external-fund synchronization/Count My Money observations, campaign financial registration, institutional grant decisions, and withdrawal reservation/completion/cancellation.

## Explicit non-claims / remaining verification

- No Base44 Builder/publish/API credit-consuming runtime verification was triggered by this repository-only pass.
- Provider APIs (PayPal, Stripe, Ko-fi, social networks) remain external integrations; this migration removes Convex/Vercel runtime dependence, not the providers themselves.
- Base44 entity deployment of the new `FinancialOperation` schema must be verified when the branch is imported/published through the normal Base44 path.
- Deterministic build/lint/type/payment tests should be run in a zero-credit local/CI environment before merge.
- Package-lock reconciliation must be verified after a Node-22 `npm install`; do not hand-edit dependency integrity hashes.
- The broader feature reconciliation ledger still contains product features whose completeness must be audited individually. Do not mark those complete merely because their old Convex dependency was removed.

## Duplicate-prevention rule

Before creating any replacement for a formerly Convex/Vercel feature, check this branch and this document. If the behavior is listed above, improve/verify the existing Base44 implementation rather than creating a second implementation. Historical repositories remain evidence only unless the owner explicitly reactivates them.
