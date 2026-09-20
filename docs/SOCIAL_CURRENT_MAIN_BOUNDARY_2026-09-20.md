# Social current-main boundary evidence

- Base: `main` at `ae1baa27d7521a14c76857569c2a63cacc3f9a54`.
- Source: `src/pages/Social.jsx`.
- Issue: #401.
- Existing stale lineage: #399 / PR #400.

## Current finding
The Social page still masks `PlatformConnection.filter({})` and `Campaign.filter({})` failures as empty arrays and commits unvalidated rows. It also derives the admin panel from `user.role`, which is not server-authoritative authorization evidence.

## This slice
Adds a focused source-contract verifier that fails closed on the current failure-masking patterns and preserves the explicit review gate around client-derived admin visibility. It does not claim to implement server-side capability checks, RLS, tenant isolation, or runtime-faithful browser/mobile validation.

## Required next correction
Rebaseline the actual page implementation from this exact main, then replace the masking with bounded response validation, mounted/request-generation fencing, and stable safe copy. Keep the server-authoritative authorization/RLS work separate and review-gated.
