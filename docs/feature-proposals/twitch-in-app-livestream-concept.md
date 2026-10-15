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

## Required infrastructure decision: Twitch carries IFund Live video

**Owner clarification (October 15, 2026):** Users must be able to stay **inside the IFund app** both when broadcasting and when watching, while IFund uses **Twitch's ingest and video delivery infrastructure/bandwidth** rather than hosting or distributing livestream video on IFund servers.

### Target network and responsibility map

```text
IFund creator camera + microphone (Android native encoder)
    -> authenticated RTMP/RTMPS stream to Twitch ingest
    -> Twitch streaming infrastructure, transcoding and CDN
    -> official Twitch embedded player in IFund campaign/live screen
    -> viewer stays on IFund: [Donate] [Bid] [Rewards] [Chat]

IFund API/storage: campaign authorization, Twitch account link/status,
auction bids and close/winner, donations, purchase receipts, payout accounting.
NO default IFund media ingest, video relay, streaming CDN, or video archive.
```

**Bandwidth ownership:** Broadcaster still uses their own device's upload bandwidth to reach Twitch; **Twitch** handles video ingest and distribution to viewers. IFund incurs normal app/API traffic and integration costs (and may incur separate encoder, mobile support or implementation costs), but should not carry the live video stream through IFund hosting. Do not claim this means video is cost-free or that Twitch guarantees unrestricted embed access.

### Android APK: creator remains in IFund for Go Live

- Use native Android camera/microphone capture and on-device real-time encoder, feeding Twitch's documented RTMP ingest (or currently Twitch-approved secure transport if available). Avoid routing the actual video through Base44 functions or Cloudflare Workers.
- Users connect their own Twitch account via OAuth and see connection status, stream preview, start/stop, bitrate/connectivity warnings, title and moderation **inside IFund**. Login authorization may require an external secure consent page / Android Custom Tab; return to IFund automatically afterward.
- An IFund backend authenticates the creator, connects Twitch API credentials, fetches or authorizes access to channel-specific ingest credentials, and protects them. Never commit stream keys or reusable tokens to source or analytics, expose them in public frontend bundles, or persist plaintext client storage. Sending video directly from a device may require transmitting a stream credential to its trusted runtime; assess risks, permissions, rotation and revocation.
- Twitch's server publishes the broadcast, and IFund loads the linked channel's approved embedded player in creator/viewer campaign screens. Verify actual stream-live status rather than assuming a Go Live button means it was published.
- Validate Android native/Wix/Base44 webview playback requirements and approved embed domains. If Twitch blocks playback in an APK WebView, use a permitted in-app web surface / app-compliant fallback and document any unavoidable external Twitch login or playback.

### Website: watch stays inside IFund; web Go Live needs extra technology

- Viewer playback/chat use Twitch's official embed on HTTPS with accurate `parent` domain(s), minimum player dimensions and unobstructed Twitch controls and ads.
- Browser camera APIs can capture audio/video but ordinary browsers **do not directly publish RTMP to Twitch**. A browser-only Go Live path requires a compatible client-side encoder or a **separately costed WebRTC-to-RTMP gateway**. Prioritize direct-to-Twitch Android capture first; do not quietly deploy an IFund-hosted high-bandwidth bridge contrary to the user's direction.
- Keep all IFund checkout, auction-bid and reward flows in the surrounding IFund app, not in a Twitch Extension or embedded Twitch checkout. Separate session state from video buffering and network failure.
- Twitch's embed may ask for Twitch login or popups for chat, subscription or consent, even if the viewing page never navigates away. IFund cannot override Twitch authentication controls.

### Source references verified October 15, 2026

- Official Twitch broadcast transport/ingest: https://dev.twitch.tv/docs/video-broadcast/
- Twitch approved video player/HTTPS parent-domain/controls: https://dev.twitch.tv/docs/embed/
- Twitch embedded chat: https://dev.twitch.tv/docs/embed/chat/
- Twitch Extensions commerce restrictions: https://dev.twitch.tv/docs/extensions/guidelines-and-policies/

**This is a binding design constraint for the feature branch, not a claim of an operating Twitch integration.** Prototype and verify the entire Android and website flow in this isolated workspace. Do not change existing live video/payment providers or publish until permission, policy, performance, settlement and security tests pass.

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
