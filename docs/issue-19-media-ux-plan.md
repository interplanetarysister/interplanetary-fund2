# Issue #19 — Campaign Multi-Photo Media UX Plan

## Status
Planning-only. No runtime behavior is changed by this document.

## Source of truth
Issue #19 requires campaign creators to upload their own photos and attach multiple photos to a campaign. Video is explicitly out of scope for this slice. The existing campaign creation and campaign-detail surfaces must be inspected before implementation so the feature reuses the current canonical campaign/media architecture rather than introducing a parallel media system.

## Required assessment before implementation
1. Inspect the current Campaign/CreateCampaign schema and all existing image/media fields and callers.
2. Identify whether campaign images are stored as URLs, uploads, generated assets, or another canonical representation.
3. Trace every campaign-media reader and writer across web, Convex/backend, and Capacitor packaging.
4. Determine whether the current storage/upload capability already supports multiple assets; if it does, extend that contract rather than creating a second storage path.
5. Identify owner/admin authorization boundaries for adding, replacing, reordering, and removing campaign media.
6. Confirm generated cover images remain distinct from user-uploaded campaign media and preserve the existing signature-style generation contract.
7. Establish bounded media constraints before coding: maximum asset count, accepted image types, maximum dimensions/size, safe failure behavior, and deterministic ordering.
8. Confirm deletion/replacement semantics do not remove a generated cover or another user's asset accidentally.
9. Check campaign-detail first-viewport requirements so multiple media assets do not push title, donate CTA, and description below the initial mobile viewport.
10. Define keyboard, screen-reader, touch, focus, loading, error, and empty-state behavior.

## Implementation shape after plan approval
- Reuse the existing campaign media/storage contract where available.
- Add an explicit ordered campaign-media representation only if current schema cannot represent multiple owned assets safely.
- Keep campaign ownership checks server-authoritative for mutations.
- Keep uploads bounded and reject unsupported/oversized assets before persistence.
- Preserve one canonical generated cover plus optional user-uploaded gallery media unless repository evidence establishes a different existing contract.
- Provide simple mobile-first add/remove/reorder controls without requiring drag-and-drop as the only interaction.
- Keep video excluded from this implementation.
- Add regression coverage for ownership, bounds, ordering, deletion, duplicate submissions, and generated-cover preservation.

## Acceptance criteria
- A campaign owner can upload multiple supported photos and see them in deterministic order.
- An unrelated user cannot mutate another campaign's media.
- Administrators retain only the existing authorized moderation capabilities; no new privilege is inferred.
- Invalid, oversized, or excessive uploads fail safely without partial corruption.
- Removing/reordering user media cannot remove the canonical generated cover unintentionally.
- Campaign detail remains mobile-friendly and preserves the primary title/donate/description first-viewport goal.
- Keyboard and screen-reader users can perform the same core media operations.
- No video workflow is introduced.
- Existing campaign creation, generated-image regeneration, donation, and embed behavior remain intact.

## Required workflow
1. Agent 2+3 review this plan against the actual repository schema/storage/callers.
2. Agent 1 corrects every valid plan finding and verifies the exact head.
3. Only after plan approval, create the implementation draft.
4. Run exact-head CI and applicable Development/browser/mobile validation.
5. Run the full 1→2→1→3 workflow before publication.

No implementation or completion claim is made by this planning artifact.
