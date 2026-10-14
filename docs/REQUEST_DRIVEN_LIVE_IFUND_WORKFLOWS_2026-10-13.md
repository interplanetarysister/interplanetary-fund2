# IFund live workflow authority — request-triggered operations

Source of truth: `interplanetarysister/interplanetary-fund2`. Legacy repositories hold history and read-only manual diagnostics only. They MUST NOT build, deploy, publish on behalf of users, or mutate IFund production data.

## What a user click should do

1. **Outreach advice:** Campaign owner clicks "Request outreach guidance" in the campaign distribution panel. The frontend invokes `runOutreachAgent({campaign_id})` with the owner's existing authenticated Base44 session. Server verifies active account, campaign ownership, active campaign, outreach settings, subscription and active OBO consent; processes **only that campaign** and records recommendations/drafts, not external posts. Duplicate requests are cooled down. If no request, no execution.
2. **Prepare outreach publication:** A user clicks "Fill posts with AI" or "Draft posts for selected accounts" in `DistributionPanel`. Calls `generateDistributionContent` or `createDistributedPost` with an owner-selected campaign, verified connection IDs and content. These are existing server-authorized actions. Save `DistributedPost` drafts, do not publish.
3. **Publish externally:** Owner selects and approves drafts, then invokes `publishPost({post_id,user_publish_authorized:true})`, or deliberately invokes `broadcastPosts({campaign_id})` under its stronger AI-consent/subscription conditions. `ownerAgentChatActions` handles clear authenticated owner chat instructions like "approve all drafts", calling the same authority. Verify caller/post/campaign/connection ownership and provider permission **on every request**. Treat a provider-confirmed post URL/state as success; return manual-share status otherwise. No GitHub token or Actions workflow has user authorization to publish.
4. **Connections, external fundraising sync:** Require a current, scoped user/admin action for external sync. Do not revive scheduled external fund syncing. Provider webhooks, PayPal callbacks, payment reconciliation and other financial integrity processes are separate and must remain functioning.
5. **Platform-specific permissions:** Never guess direct publishing support. Reuse `publishPost` verified capability checks, consent version and existing protected connection credentials. A lack of authorized posting capability must produce an owner-facing draft/manual path, not a claimed publication.
6. **Retries:** Idempotent server actions only; reconcile actual provider state first. Never retry unconfirmed external writes blindly or loop on an hourly GitHub Action.

## Scheduled legacy outreach workflows

The source definitions of `AI Outreach Agent.jsonc` and `Social Media Autopilot.jsonc` are parked with `trigger: null`. Existing deployed Base44 automation objects, if any, also need independent pause verification in Base44's live workflow settings. A GitHub commit alone does not prove a published backend schedule was disabled. Keep the retired global `runSocialAutopilot` function off automated triggers; creator requests use the existing owner-scoped distribution actions instead. Other workflows such as settlement reconciliation and explicitly authorized delayed posts require independent scope assessment before pausing.

## Web and Android

- Public website: `https://interplanetaryfund.com/`; Base44 backend/frontend: `https://interplanetaryfund.base44.app/`.
- Build the shared web assets once and use `npx cap sync android` to copy those **exact bytes**. `scripts/verify-android-firebase.mjs` checks shared assets. The manual APK workflow also compares the release marker embedded in the package to the website build.
- Homepage offers **Install IFund web app**; this follows the live website. It offers native APK only if `ifund-android-release.json` reports a published APK whose release ID and full source SHA match the live `ifund-release.json`, includes an official HTTPS URL ending in `.apk`, and includes the APK SHA-256. Otherwise no download URL is displayed.
- The existing debug APK is a short-lived GitHub Actions artifact, **not** a permanent or release-signed download. For a permanent downloadable Android app, complete device login/OAuth/payment-flow testing, configure signing and publish a retained release artifact. Stamp the identical source SHA into the web and Android release metadata, then verify both deployed files and actual APK digest before setting status `published`.
- As long as the web and APK are not proven to correspond to the exact published revision, the website must withhold the APK link and continue offering the up-to-date installable web app.
- A website update invalidates an older APK match. Rebuild and reapprove the Android package from that exact source before re-advertising it. Prefer release/event-driven checks, not frequent polling.

## Activation

All edits were prepared on branch `ifund2-live-web-android-download-parity-20261013` only. No GitHub Actions job or live publication should be triggered until the owner directs activation. The `main` branch is protected and may require passing checks/review; do not bypass the protections or introduce a cost-consuming PR without approval. No changes to donations, PayPal settlement algorithms, financial ledgers, or account permission tables are authorized by this workflow change.
