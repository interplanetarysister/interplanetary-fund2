# IFund Live — Twitch in-app livestream concept

**Status:** Saved product concept — discussion/design phase only, not implemented.
**Workspace:** `feature/donation-rewards-safe-workspace`.
**Direction approved for exploration:** Support both watching Twitch livestreams inside IFund and starting Twitch broadcasts from IFund, with campaign donations and live auctions accessible alongside the video.

## User experience: watch and participate within IFund

A campaign's **Live** view should keep the stream and ways to help together in one place.

```text
┌─────────────────────────────────────────────┐
│ Campaign title                       LIVE  ●│
├─────────────────────────────────────────────┤
│                                             │
│          TWITCH LIVESTREAM PLAYER           │
│                  [video]                    │
│                                             │
├─────────────────────────────────────────────┤
│    [ ♡ Donate ] [ ⚒ Bid live ] [ Chat ]     │
├─────────────────────────────────────────────┤
│  Creator · Campaign goal · Progress         │
│  Live auction item / current bid / countdown│
│  Reward options · Stream details            │
└─────────────────────────────────────────────┘
```

- Viewers should be able to **watch a connected Twitch stream on an IFund campaign/auction page** without being required to navigate away from the IFund website or APK where a supported embedded player works.
- A persistent **Donate** action opens IFund's verified payment flow tied to the correct campaign; viewers should not lose the stream context when moving between video and checkout.
- When the creator hosts an auction, **Bid live** exposes active item details, bid status, and server-confirmed results. A bid is not a donation or an authorized payment; credit funds only after a verified successful purchase.
- **Chat** opens a permitted Twitch chat embed or in-app companion panel, preserving an accessible way to view video and talk; comply with Twitch authentication, moderation, and embedding policies.
- On narrow screens show responsive stacked video and controls, with a compact bottom action bar or tabbed panels. Support landscape, touch, accessibility, video failure/offline fallback, and low-bandwidth conditions.
- IFund continues to own the campaign experience, rewards, auction flow, payments, receipts and withdrawals. Twitch provides the stream/channel, not an authority to update the IFund donation ledger.

## Creator experience: stream *from* IFund

A campaign creator or authorized host can open the campaign's **Live** controls, connect a Twitch account, and choose **Go Live**. Proposed in-app sequence:

1. **Connect Twitch** securely using official OAuth, verify the channel and required scopes, explain data access, and allow disconnect/revoke.
2. **Prepare stream:** choose camera/mic, title, campaign, optional live auction item, preview, audio/video permissions, and optional moderation settings.
3. **Go Live:** if technically and contractually supported, capture/encode video locally on the device or browser and stream to the creator's Twitch channel using Twitch-supported ingest; do not assume embedding the Twitch player alone enables broadcast.
4. **Manage Live:** see broadcast state and campaign-linked donations/bids, open chat and end the broadcast. Reconcile actual Twitch state and recovery after network drops; never equate a successful "Go Live" click with a confirmed public stream.
5. **End stream:** stop capture/ingest, close or separately continue the auction as allowed, and show a verified campaign activity summary without counting unsettled bids as raised donations.

**Implementation caution:** Native Android streaming requires a suitable camera/microphone capture and realtime video/audio encoder and secure Twitch ingest; browser-based capture has device and platform limitations. Research Twitch's current ingest/broadcast requirements and the Android APK's capabilities before selecting architecture. Never expose a Twitch stream key to other viewers, log it, or embed it in frontend bundles.

## Streaming + auctions + campaign rewards

- Creator-defined donation incentives and fulfillment commitments appear near the live stream, with clear eligibility and remaining inventory.
- An authorized seller may offer an item via live auction. Viewers bid in IFund while viewing the Twitch video. Verified winner payments are credited to the designated campaign's **auction proceeds**.
- Proposed **10% IFund auction hosting/withdrawal fee**, displayed to the campaign owner during auction-proceeds withdrawal; apply **instead of**, not on top of, the ordinary 3% donation withdrawal fee for those auction funds. Ordinary gift-first donations retain their preexisting fee policies. Fee basis, taxes, processor fees, shipping and refund rules need confirmation before coding.
- The auctioneer/fulfillment owner is responsible for accurately describing and supplying promised items. IFund must still meet applicable mandatory consumer and platform obligations; a seller disclaimer cannot waive them.

## Twitch policy/design boundaries to validate

- Use current Twitch embed requirements, approved domains, player sizing, OAuth scopes, chat restrictions, broadcaster authentication and rate limits.
- Keep **Donate** and **Bid live** as IFund-owned page/app controls adjacent to the Twitch video. Do **not** assume Twitch permits checkout within a Twitch Extension or a Twitch-native donation icon; any future in-Twitch commerce path needs separate provider approval.
- Verify that Twitch embedded playback and chat work in IFund's Android package; provide a user-friendly native app/deep-link fallback if a provider or device prohibits embedded playback.
- Protect user identities, payment details, broadcaster tokens, minors and moderators; enforce server-side authorization and replay-safe payment/bid accounting.

## Approval and release checkpoints

**Not yet implemented.** Prototype video layout and creator Go Live controls in this isolated branch; test responsive behavior and accessibility. Then separately validate Twitch account authorization, permitted embed and ingest routes, livestream + bid synchronization, provider settlement and dispute handling, backend entitlements, existing donation accounting, withdrawal fee segregation, website and APK parity. Do not change production or historical donation records until reviewed and approved.

Related discussion: [Donation rewards, live auctions and Twitch](./donation-rewards-live-auctions-twitch.md).
