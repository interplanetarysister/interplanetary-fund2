# IFund image and campaign-copy verification — October 8, 2026

## Source changes

The signed-in user image-editing backend accepts two public, app-owned media URL patterns:
- `https://media.base44.com/images/public/<IFund-app-id>/...`
- `https://base44.app/api/apps/<IFund-app-id>/files/mp/public/...`

Both patterns have real IFund media in use. Any unrelated external host or foreign app ID is rejected.

The backend sends the actual original photo as `images:[{image_url}]` to the authorized image-edit API when configured; otherwise it returns a clear credit-free treatment mode. Client-side compositing retains the original photo as the full-opacity base, overlays IFund styling, embeds the logo and domain, then saves a new output. Original uploads remain unchanged.

The Reown wallet's icon has been aligned with `/icon-192.jpg`, derived from the same verified planet logo used elsewhere. Campaign embed HTML, one-click/manual clipboard fallback, and copy-ready update creation have regression tests.

## Verification completed

- Public `https://interplanetaryfund.com/` and `https://interplanetaryfund.base44.app/` responded HTTP 200.
- The actual logo file returned HTTP 200 on the live domain; the reference image from Base44 (Copy) is tracked by checksum in image-style regression tests.
- Base44 public media returned HTTP 200, image type and permissive CORS.
- A real existing `base44.app/api/apps/.../files/mp/public/...` image returned HTTP 200, image/png and permissive CORS.
- All image-style, compositing, campaign-copy, draft, cover-generation and action-navigation regression tests pass in the source environment.
- Local frontend build, TypeScript and lint are part of the release gate.
- No live paid image-generation operation has been initiated.

## Remaining deployment check

Published site currently serves `/assets/index-B3viOyYY.js` while the freshly built local main produced a different entry bundle (`index-BuZ9dZvN.js` before the latest fixes); the local compiled bundle was not present on the public host. This indicates a build/deployment mismatch; compare the published build after publishing the latest main. Bundle fingerprints can also vary by environment, so the final proof is a real authenticated browser run.

After publishing main:
1. Open campaign creation, upload a genuine photo, click **Generate IFund-style improvement**, and confirm the actual source photo remains recognizable.
2. Confirm the watermark planet and `interplanetaryfund.com` are faintly present in the newly saved file and not only an HTML overlay.
3. Confirm the result displays after refresh and from a public campaign page.
4. Try the credit-free **Generate IFund image** in the social composer.
5. Paste the campaign iframe HTML into a separate site and open the link.
6. Generate a campaign update, copy its text and save an incomplete draft.
7. Revoke/omit image-editing API credentials and verify the credit-free fallback still works.

A real third-party image-edit request may incur provider charges; test only with authorized budget and billing controls.
