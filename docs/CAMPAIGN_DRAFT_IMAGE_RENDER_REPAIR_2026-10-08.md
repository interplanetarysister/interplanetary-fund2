# Campaign image rendering + save-at-any-step draft repair

Date: 2026-10-08
Target: Interplanetary Fund Base44 project source

## Repairs

### Generated images

- Campaign cover generation now calls the authenticated backend `generateCampaignCover`,
  validates the returned URL, preloads and decodes the image in the browser, and
  updates the campaign only after the new file is confirmed loadable.
- Image generation failure never silently replaces the chosen cover. It displays
  an actionable error; a separate, credit-free **Use free branded cover** option
  is available and clearly labeled as an alternative.
- Shared Image component now gives transformed Wix/Base44 photos real intrinsic
  height instead of absolutely positioning them inside undimensioned wrappers.
  If a CDN transform fails, it retries the underlying original asset before
  displaying a fallback. This affects campaign covers, card images, social posts
  and other platform surfaces that share the component.
- Uploaded-photo IFund conversion also preloads and decodes before updating.
- AI official social post creation refuses missing/malformed generated image
  responses instead of saving a broken media URL.
- Provider availability, image generation quality and final published-browser
  rendering require real interactive tests after deployment. Source tests do not
  establish third-party service availability.

### Save draft at ANY wizard step

- Campaign schema accepts an empty title and zero goal for private drafts; active
  campaigns still require title, goal and story. Existing owner-only draft RLS
  remains unchanged.
- Backend permits and preserves `ai_profile`, `story_versions`, and
  `draft_step` in addition to the visible campaign fields.
- **Save draft** is available on all four creation steps. A first save creates
  the draft and keeps the builder on the same step.
- Reopening a draft restores the step reached, story/version history, AI choices,
  campaign fields and optional image.
- Dashboard draft cards link back to the editor and show **Untitled draft** when
  no title has been entered; no fake fundraising totals are shown.
- Protocol enforcement no longer requests completed content or launches agents
  on an intentionally unfinished private draft.
- The creator can later complete the required fields and publish normally.
  Drafts stay private under the existing Campaign RLS.

## Verification

- Mock handler regression tests cover creating totally blank drafts, updating a
  middle-step draft, rejecting incomplete public launch, owner authorization,
  and missing authentication.
- Generated-media helpers are tested for valid/invalid URLs, successful browser
  image loads and failures; backend generator mock tests cover authentication,
  missing assets, malformed responses, exceptions and multiple return shapes.
- Source regressions assert fixed image layout and safe untransformed retry.
- Local TypeScript, ESLint, Vite build, production-build-output contract and
  existing server-authoritative mutation checks passed.

## Deployment checks

1. Publish current `main` in Base44.
2. Open Create Campaign; from step 1, click Save Draft with no title or goal,
   then verify it appears privately in Dashboard > Drafts.
3. Return to the draft, enter some fields on step 2 or 3, save and reopen. The
   active wizard step, story history, AI selections and image must persist.
4. Generate an actual AI cover. Confirm the result is visible immediately and
   after refreshing, saving and reopening the campaign; if provider unavailable
   confirm failure notice and old cover intact.
5. Try a Base44/Wix-hosted uploaded image and a normal HTTPS media URL. Confirm
   full-size image and social post thumbnail occupy visible space on mobile.
6. Test the free branded graphic without image-generation credits.
7. Verify a fully completed campaign can publish, while blank drafts remain
   private and are not exposed in public search.
