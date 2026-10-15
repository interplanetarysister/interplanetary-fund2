# Draft proposal — IFund donor rewards, creator incentives, live auctions & Twitch

**Status:** Discussion only; no production implementation approved.  
**Workspace:** `feature/donation-rewards-safe-workspace` in `interplanetarysister/interplanetary-fund2`.  
**Safety boundary:** Do not change donation/payment ledgers, live checkout, withdrawal code, existing 3% standard-donation fee, existing records, web deployments, or APK until design, tests, and explicit rollout approval.

## User-defined goals

1. Campaign creators may offer **their own donor incentives and rewards** tied to campaigns, with clear eligibility, quantities, commitments and fulfillment details.
2. Campaign creators/authorized auction hosts may **run live item auctions** to raise money for a specified IFund campaign. The winning bidder purchases the item, and proceeds are credited to that campaign.
3. The **person offering/hosting the auction is responsible** for delivering the item/service and making good on their promises. Show this obligation to the host and bidders before they commit; IFund must still define its own applicable consumer-protection and payment duties.
4. **Auction-item proceeds** have a distinct **10% IFund withdrawal/hosting fee**, calculated at auction-proceeds withdrawal, rather than applying the regular 3% campaign-donation withdrawal fee a second time. Confirm any processing fees and precise amount basis before coding. Do not pre-deduct the fee from campaign's gross credited auction proceeds.
5. Campaign hosts should be able to **live stream** and let viewers **donate to the associated campaign while watching**, and optionally view/bid on live auction items.
6. **Twitch integration is required**, alongside any future first-party streaming capabilities. Streamers should be able to connect a Twitch channel, show its live video on their IFund campaign or auction page, and retain access to IFund's donations/bidding UI.

**Approved concept for exploration:** Support both in-app watching and in-app creator broadcasting to Twitch, with campaign **Donate**, **Bid live** and **Chat** controls alongside the video. [Detailed UI mockup and streaming concept](./twitch-in-app-livestream-concept.md).

## Twitch-specific integration path (subject to provider validation)

- First phase: **Twitch OAuth** for account linking, stream/channel verification, live/offline state; an HTTPS **Twitch-approved embedded player/chat** on the IFund website, with the required `parent` domain(s), official player controls and minimum player sizes.
- Put IFund's **Donate** and **Bid** controls in IFund's own page *alongside* the Twitch embed. Associate transactions with the campaign and optional auction/session, preserving the stream as the viewing context where supported.
- Potential Twitch channel profile links or permitted channel/chat instructions can direct viewers to an IFund campaign page; review Twitch terms and moderator rules first.
- **Do not assume** a Twitch Extension may host checkout or link viewers to a third-party purchase/donation page. Current Twitch Extensions commerce rules prohibit embedded third-party payments and payment links; do not promise an in-Twitch purchase/donation icon until Twitch explicitly approves a compliant route.
- For the mobile APK, favor an app-friendly Twitch link or compatible supported player while maintaining donation and auction controls; verify device/browser policies before selecting the final UX.
- Store tokens server-side, use narrow OAuth scopes, explicit revocation, verified callbacks/webhooks where available, and avoid exposing payment details to Twitch chat or overlays.

## Accounting and auction trust boundaries

- Keep **ordinary gifts**, **optional donor 10% platform support**, and **auction purchase proceeds** as separate event/ledger types. Ordinary donations retain the already-approved gift-first checkout and **3% withdrawal fee**. The optional donor 10% support is unrelated to auction's 10% hosting fee.
- A provisional auction close/highest bid is **not settled revenue**. Confirm the winning bidder, authorize/capture a verified payment, handle failed payment and timed-out winners, then credit the campaign according to the actual money received. Keep the item sale amount visible separately from ordinary donations and do not imply an auction purchase is automatically tax-deductible.
- Show gross auction sales credited to the campaign before withdrawal. On withdrawal, provide itemized **10% auction hosting fee**, ordinary-donation **3% fee** on ordinary funds only, processor charges/refunds, and accurate net payout. Avoid double-counting revenue, pledges, bids and reversals.
- Define reserve/opening bid, bid increments, anti-sniping/time extensions, seller cancellation limits, winning-bid finality, item ownership/permission, proof of shipment or delivery, taxes/shipping, restricted item rules, chargebacks/disputes, identity verification, moderation, creator responsibility and IFund's non-waivable legal obligations before launch.
- Reward obligations similarly require clear eligibility, inventory caps, expiry, disclosure, cancellation/refund policy, and creator fulfillment status; no rewards assumed delivered merely because a donation settled.

## Implementation plan after design approval

1. Confirm fee examples and auction-vs-donation terminology; finalize rewards and auction rules with a legal/payment-provider review.
2. Mock the campaign reward panel, Twitch-linked live stream view, auction item catalog, bid/winner states, and accessible mobile flow **in this branch only**.
3. Define backend schema and server-authoritative transitions for bids, winner selection, provider settlement, campaign credit, refunds, fulfillment and withdrawals. Add idempotency and anti-fraud checks.
4. Test with provider sandbox and simulated Twitch offline/live callbacks; run regression tests on existing payments, historical records, site and APK; require PR review before promotion.

## Decisions to discuss before build

- Can **any** authenticated user hold an auction for a campaign, or only the campaign creator and specifically authorized hosts?
- Are rewards fulfillment promises tied to donation amounts, fixed inventory, or both?
- Is the auction's **10% withdrawal/hosting fee the sole IFund percentage** on auction proceeds (proposed: yes), and who pays payment-processing/shipping/taxes?
- How are unsold, unpaid, returned, lost, misrepresented or disputed items handled, and when are auction proceeds withdrawable?
- Is connecting an existing Twitch channel sufficient initially, or should IFund also support direct in-app broadcast creation?

## Twitch documentation checked (October 2026)

- https://dev.twitch.tv/docs/embed/
- https://dev.twitch.tv/docs/embed/video-and-clips/
- https://dev.twitch.tv/docs/extensions/guidelines-and-policies/
- https://dev.twitch.tv/docs/extensions/submission-best-practices/
