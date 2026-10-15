# IFund open-source and low-cost integration research — October 15, 2026
**Research/decision report v1 — not installed, not deployed, no payment code changed**

**Branch:** `feature/donation-rewards-safe-workspace`  
**Scope:** In-app Twitch watching + creator Go Live using Twitch's bandwidth, live item auctions with proposed 10% auction withdrawal/hosting fee, campaign-specific rewards, creator-owned cross-platform connections, free/licensable code, and portable low-cost hosting.  
**User constraints:** preserve authoritative `interplanetarysister/interplanetary-fund2`; clone/test before main; preserve existing verified PayPal donations and historical financial algorithm; ordinary gifts and 3% withdrawal fee stay separate; no Stripe required; only user-requested external fund sync; no artificial “connected” labels for unverified providers.

## 1. What IFund already has — compatibility audit

Verified source context from the authoritative repository as inspected October 15:

- **Frontend:** React 18 + Vite 6 + TypeScript tooling + Tailwind/Radix; **Android:** Capacitor 8.4.3. Use modular React panels and one narrow native Capacitor bridge; don't rewrite the PWA/APK.
- **Backend:** Base44 SDK / functions / records remain the authoritative financial and user-account data plane; the repository has payment recovery, PayPal verification and donation ledger tests. **Do not replicate or replace these ledgers** during auction experimentation.
- **Edge:** `wrangler.toml` and `host/gateway/worker.js` already define a Cloudflare Worker for narrowly scoped API health/MCP/admin routes, while the `host/gateway/README.md` documents Base44 remaining authoritative. New auction routes would require explicit routing, auth, verification and deployment checks; don't assume all Cloudflare services are live merely because a config exists.
- **Social publishing:** `base44/shared/socialPublish.ts` already supports Bluesky using an app password, LinkedIn through an approved user OAuth path, and intentionally disables arbitrary-instance Mastodon publishing for SSRF safety. **Do not bypass those safety boundaries.**
- **Current rewards are unrelated:** there are existing social-post/profile banner reward tiers, but no verified, production-ready *campaign creator donor-reward* or live-auction engine was found in the main-branch code search.
- **Twitch:** Base44's connected-app catalog lists Twitch as available, but **not connected** for this application. Catalog availability is not creator-level OAuth or a live video path.
- **No production action in this report.** Candidates below are reusable source projects, SDKs, architectural references or service free tiers; none is claimed tested against IFund's production environment.

## 2. Recommended stack — highest fit, lowest replacement risk

| IFund capability | Candidate and code/source | License/availability (checked) | IFund fit | Selection and limitations |
| --- | --- | --- | --- | --- |
| Watch Twitch **inside IFund** | **Official Twitch iframe/JS player & chat**, [developer docs](https://dev.twitch.tv/docs/embed/) | Twitch developer service, **not open source**; embedding usable subject to Twitch terms, not an unrestricted code license | **Excellent** in React browser; APK WebView **unverified** | **FIRST CHOICE.** No npm dependency needed. Twitch serves playback bytes, while IFund keeps Donate/Bid controls adjacent; HTTPS, correct `parent` domain, minimum 400×300 video, unobstructed player and ads. Confirm WebView and chat auth behavior on devices. |
| React convenience wrapper | **react-twitch-embed**, [npm](https://www.npmjs.com/package/react-twitch-embed), [source](https://github.com/moonstar-x-libs/react-twitch-embed) | **MIT** according to current npm 3.1.0 metadata; package requires Node >=20.19 | Good; extra dependency | **OPTIONAL** only if official embed integration becomes unnecessarily complex. A wrapper does not relax Twitch player terms; test our Node-version CI policy. |
| **Go Live** from IFund Android | **RootEncoder** (PedroSG94), [source](https://github.com/pedroSG94/RootEncoder), [Android/JitPack install docs](https://github.com/pedroSG94/RootEncoder#compile) | **Apache-2.0**, including Android camera/encoder and RTMP modules, with license/notice preservation | **Excellent targeted native fit** for existing Capacitor APK | **TOP RECOMMENDATION.** Build a small native Kotlin/Java Capacitor plugin around it (camera/audio permissions; start/stop; progress/reconnect; foreground service as Android requires). Phone encodes/upload to Twitch RTMP; Twitch handles viewer CDN. Validate published JitPack artifact/version, RTMPS transport, ARM ABI, Android background rules, physical device and bandwidth. Never bundle a stream key into JS assets or logs. |
| Per-user Twitch API, status/chat/EventSub | **Twurple**, [source](https://github.com/twurple/twurple), [npm API](https://www.npmjs.com/package/@twurple/api) and [auth](https://www.npmjs.com/package/@twurple/auth) | **MIT**, maintained modular JS/TS SDK | High if runtime supports npm + credentials; **not tested** on Base44/Workers | **TOP CANDIDATE** for channel info, token refresh, EventSub. Put OAuth/token custody **server-side** and verify per-user identity; use native `fetch` if environment compatibility or SDK dependency cost is a problem. Token refresh is not permission to publish/stream without approved scopes. |
| General external-provider OAuth | **oauth4webapi**, [source](https://github.com/panva/oauth4webapi), [license](https://github.com/panva/oauth4webapi/blob/main/LICENSE.md) | **MIT**; Web Standards; supports Node, Deno, Cloudflare Workers | **Excellent** common foundation for new connectors | **RECOMMEND** as a *possible replacement for bespoke OAuth protocol handling*, not provider-specific business policies. Apply PKCE/state/redirect validation, user-scope binding, rotation, server-side token encryption. Test Base44 SDK adapter and existing connection ownership; no migration without proofs. |
| Real-time bid ordering | **Cloudflare SQLite-backed Durable Objects**, [official pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) | **Service with free plan**, **not an open-source package**. Free includes limited requests, duration, SQL rows/storage; subject to quota changes and ToS | **Excellent architectural fit** with existing Cloudflare Worker route | **TOP HOST CHOICE.** One Durable Object per auction serializes competing bids and broadcasts accepted events; use **WebSocket hibernation** and monotonic server timestamps. Never trust client clocks or bids. State can be rebuilt from authenticated immutable events. Free quotas may be insufficient at high concurrent bid rates; benchmark before use. Keep all fund custody in Base44. |
| Edge routes to support bid API / Twitch OAuth | **Hono**, [source](https://github.com/honojs/hono), [license](https://github.com/honojs/hono/blob/main/LICENSE) | **MIT**, lightweight, Web Standards, Cloudflare Worker/Deno/Node-compatible | Very good | **OPTIONAL** improvement for *new* bid/OAuth handlers, not a mandatory replacement of existing tested `host/gateway/worker.js`. Preserve routing, admin-only paths and original payment safety boundaries. |
| Campaign incentive rewards | Existing React/Radix + Base44 schema and authorized endpoints | Existing app; no new third-party code license | **Best initial fit** | Add campaign reward definitions, eligibility/inventory, claimed/fulfillment statuses, cancellation/refunds and receipts as **new** entities. Do not repurpose the unrelated social profile banner rewards or misclassify conditional-purchase benefits as charitable gifts. |
| Auction sales, orders, inventory, refunds (future) | **Medusa core commerce modules**, [source](https://github.com/medusajs/medusa), [modular docs](https://docs.medusajs.com/resources/commerce-modules) | **MIT core; proprietary enterprise features excluded**, [license](https://github.com/medusajs/medusa/blob/develop/LICENSE) | **Moderate**; Node/service plus database architecture, **not a drop-in Base44 function** | **OPTIONAL targeted replacement** for *auction commerce/order/fulfillment modules* if native IFund implementation becomes too complicated. Does **not** bring a production-ready auction bid engine, PayPal marketplace approval, Twitch, or IFund's 10% withdrawal policy automatically. Test separate service overhead and migration; do not replace main platform or donation ledger. |

### Design of a safe, low-cost in-app Twitch auction

```text
Creator's IFund Android APK
    Camera/mic -> RootEncoder -> Twitch-approved RTMP ingest
                         [IFund video relay: NONE]
    IFund authorization -> scoped Twitch OAuth via approved backend

Viewers: IFund React/Capacitor screen
    [Twitch official video/chat embed] -> Twitch's distribution network
    [Donate] [Bid] [Rewards] -> IFund server endpoints

Bids (new, separate capability): IFund session validation at Worker
  -> Cloudflare Durable Object for this auction (atomic bid acceptance,
     time, sequence, anti-snipe, idempotency, fanout)
  -> durable audit log / bid history; bidder authorization revalidated

Winner: server closes auction -> pending buyer checkout -> approved provider
  verifies capture/settlement -> existing Base44 financial authority
  credits eligible auction proceeds without fabricating donations
  -> at withdrawal apply proposed 10% auction hosting fee once
     (NOT 3% again to those auction proceeds).
```

Do **not** ship an auction until creator verification, seller disclosures, chargebacks, refund funding, provider permission for item sales/marketplace funding, legal licensing and tax treatment are reviewed. Preserve donor-selected gift-first charging and historical records. See the separate legal framework draft.

## 3. Open-source integration/hosting options beyond GitHub alone

Research sources also include **npm package metadata**, **official Cloudflare pricing/docs**, **Twitch API docs**, **Activepieces licensing docs**, **Node-RED foundation documentation**, and **Medusa commerce docs**; GitHub alone was not treated as license or compatibility proof.

| Candidate | Source + official licensing | Advantages | Reasons not to replace IFund immediately |
| --- | --- | --- | --- |
| **Activepieces Community core** | [official license](https://www.activepieces.com/docs/about/license), [source](https://github.com/activepieces/activepieces) | **MIT core**, substantial integration/automation catalog; may accelerate optional user-authorized posting/event flows | **Enterprise and commercial directories excluded**. A self-hosted orchestration server typically entails compute, persistent DB/queue, patching and credentials. “Free license” ≠ free 24/7 hosting. Test a narrow, creator-owned workflow before replacing provider adapters. Must preserve direct per-user OAuth and on-demand external fund sync. |
| **Node-RED** | [official license](https://nodered.org/about/license/), [source](https://github.com/node-red/node-red) | **Apache-2.0**; visual flows, webhooks, APIs; light and broadly portable | Requires an always-running host and separate per-provider node license/security audit. Good developer/admin workflow runner, less appropriate as canonical payment or bid authority. |
| **Bluesky AT Protocol SDK** | [source](https://github.com/bluesky-social/atproto), [npm](https://www.npmjs.com/package/@atproto/api), [docs](https://github.com/bluesky-social/atproto/blob/main/packages/api/README.md) | **MIT/Apache-2.0 dual license**. Candidate to modernize existing IFund Bluesky publishing; official project now recommends the newer **`@atproto/lex`** for *new* applications. | Existing IFund code already publishes with an app password; a change to user-bound OAuth and a new SDK must have migration/revocation tests. No blind duplication of posts or bypassing current permissions. |
| **Supabase Realtime** | [source](https://github.com/supabase/realtime), [self-host docs](https://supabase.com/docs/reference/self-hosting-realtime) | **Apache-2.0** realtime WebSockets plus Postgres events | Requires Postgres and extra always-on runtime; conflicts with user's desire to avoid additional infrastructure. **Do not revive legacy Convex architecture**. Durable Objects are a better initial auction experiment. |
| **Cloudflare Workers, Durable Objects and D1** | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [D1 FAQ](https://developers.cloudflare.com/d1/reference/faq/) | Existing Cloudflare direction; **free quotas** support prototype; DO can serialize bids, D1 stores auxiliary searchable records | Proprietary hosted service, not reusable open-source code. Free tiers have hard read/write/request/storage caps and may fail on exceed, so auction correctness cannot depend on a free quota never being reached. Avoid video relay. Deploy only audited routes and protect API secrets. |
| **Cloudflare Turnstile** | [official free tier](https://developers.cloudflare.com/turnstile/plans/) | Free challenges for bid abuse and account actions; vendor-managed bot screening | Not open-source and not a substitute for auth, seller validation, rate limits or fraud controls. |
| **Lucide** (already installed in IFund) / **Heroicons** | [Lucide ISC](https://lucide.dev/license); [Heroicons MIT](https://heroicons.com/) | Commercial reuse of icons with required notices; good free UI illustrations/icons | Already have Lucide; **do not add a competing icon dependency unnecessarily**. Logo, photos, Twitch trademarks, copyrighted art and auction-item imagery require separate rights. |

## 4. Packages/platforms to avoid as “free unrestricted open source”

- **Nango**: [code and license](https://github.com/NangoHQ/nango/blob/master/LICENSE) are under **Elastic License 2.0**, not OSI open source. Self-host may have a limited free offering but **hosted/managed access restrictions** make copying the platform into a multi-user IFund integration product materially risky without legal review. Could buy/contract later; **not selected**.
- **n8n**: [official docs](https://docs.n8n.io/) describe **fair-code/source-available**, not standard MIT/Apache unrestricted embedding. Review Sustainable Use License and embedded-customer use before integration; **not selected** as freely redistributable IFund service.
- **Automatisch**: [community license](https://github.com/automatisch/automatisch/blob/main/LICENSE) **AGPL-3.0**, some EE files proprietary. AGPL source-sharing duties and a reported dependency coupling concern increase legal and maintenance overhead. **Not a first choice** for proprietary IFund.
- **Random auction GitHub templates:** being public is **not** permission to copy. One MIT [realtime-auction demonstration](https://github.com/IvanGit91/realtime-auction) is a helpful concurrency reference but has only one repo commit, a **Java 21/Spring Boot/Postgres/Redis** backend and no verified production security audit. **Learn from the concurrency model, do not ship or blindly port it**.
- **Twitch official embed/ingest** is a proprietary API/service, **not a free software distribution license**, although it may provide the appropriate zero-video-hosting-cost mechanism subject to Twitch terms. [Twitch embed](https://dev.twitch.tv/docs/embed/) requires HTTPS, `parent`, size and unobscured player; [Twitch video broadcast docs](https://dev.twitch.tv/docs/video-broadcast/) describe RTMP ingest and broadcaster stream keys. [Twitch Extensions commerce rules](https://dev.twitch.tv/docs/extensions/guidelines-and-policies/) prohibit selling items/donations through an Extension; keep IFund checkout adjacent to playback *on IFund itself*.
- **Medusa proprietary EE**, **Activepieces EE** and third-party community plugins must never be copied merely because their source is visible.
- **PayPal or other processors:** open-source checkout SDKs never eliminate real-world provider processing/chargeback fees or substitute for a properly approved marketplace/auction configuration.

## 5. Legal reuse checklist for adoption

Before copying any third-party code into IFund:
1. Link to the **exact repository tag/commit, file-level SPDX/license, dependency licenses and official package registry**; do not rely solely on badges, search snippets or an old README.
2. Prefer **MIT, Apache-2.0, BSD or ISC** for IFund's proposed commercial, possibly closed-source application. Include full original copyright/license notices in an `OPEN_SOURCE_NOTICES` file and APK/web distributions as appropriate. Preserve Apache NOTICE/patent provisions and modification notices when required.
3. Review **copyleft (GPL/AGPL), source-available (ELv2/SSPL/BSL/fair-code), enterprise dual licenses**, non-code image/music/trademark licenses, and SaaS/API policies separately. A free download is not a grant of use.
4. Confirm no source is merely “public” without a license; never copy it without permission.
5. Inspect package provenance and supply-chain vulnerabilities (SBOM, lockfile, trusted registry, signed tags, license changes, maintainer and security posture) and **pin a tested version**.
6. Keep private app credentials and third-party auth tokens encrypted and user-scoped; OAuth account authorization is consent for a specific scope, not blanket permission to create accounts or bypass provider limitations.
7. Confirm stream embeds, media, personal data, tax treatment and auction obligations with counsel and approved payment provider. A developer license is not an auctioneer license.

## 6. Proposed safe testing sequence (no source replacement approved yet)

1. **Twitch playback proof:** Official embed inside IFund React sandbox, CSP/HTTPS/`parent` settings for actual domains, Android WebView test, offline fallback, donor checkout nearby; no hidden iframe tricks.
2. **Android broadcaster proof:** RootEncoder native Capacitor bridge in clone; local camera+mic to a creator-authorized test Twitch channel using Twitch's bandwidth, no IFund video hosting; safe stream-key handling, disconnect and Android service termination tests.
3. **Auth proof:** Compare Twurple + `oauth4webapi` with existing Base44 app-user connection handling; test revoked/expired/wrong-owner tokens and OAuth callback returning to APK.
4. **Auction proof:** Small Durable Object with synthetic user identities and pretend currency; concurrent bids, authoritative close, anti-sniping, replay and lost-connection tests; no live funds involved.
5. **Rewards proof:** IFund creator reward catalog prototype, quantity reservation/claim/fulfillment and accessibility testing.
6. **Payments proof:** After legal/provider clearance, model auction sale vs donation, 10% auction fee only at withdrawal, separate processing/tax/refund entries, idempotent settlement; preserve canonical PayPal and donor gift ledger tests.
7. **Connector proof:** Compare a single user-requested Activepieces/Node-RED pilot to existing IFund native social publishing in a **separate experimental runtime** with actual per-user permission and resource accounting. No always-on interval polling or unauthorized mass-posting.
8. **Release gate:** QA on the isolated branch, test/preview against clone, compare builds and APK parity; cost test limits. **No main merge or live publishing without review.**

## 7. Recommendation and replacement decision

**Recommended NOW:** Keep IFund's React/Capacitor/Base44/PayPal architecture and add targeted components—official Twitch embed, RootEncoder, Twurple or lean OAuth, and a Cloudflare Durable Object prototype. Preserve existing account, donation and withdrawal systems.

**POSSIBLE replacement to explicitly ask about later:** Replace a **new custom auction catalog/order/fulfillment subsystem**, *not existing donations*, with **Medusa MIT core commerce modules** **if** tests prove a better solution and there is a genuinely free, reliable hosting fit. There is no evidence from this review that a full IFund migration or replacement of financial algorithms would be beneficial. Likewise, review Activepieces only if its per-user connector features and host cost demonstrably outperform existing tested adapters.

**Important distinction:** Research verified published features and license texts, **not live interoperability tests against IFund's developer accounts**, capacity, marketplace processor approval, or actual $0 total cost.

## Source links and retrieval notes

- [npm @twurple/api](https://www.npmjs.com/package/@twurple/api), [npm react-twitch-embed](https://www.npmjs.com/package/react-twitch-embed)
- [RootEncoder README](https://github.com/pedroSG94/RootEncoder), [RootEncoder Android source](https://github.com/pedroSG94/RootEncoder/tree/master/library)
- [Twitch broadcast](https://dev.twitch.tv/docs/video-broadcast/), [Twitch embedded player](https://dev.twitch.tv/docs/embed/), [Twitch Extension commerce policy](https://dev.twitch.tv/docs/extensions/guidelines-and-policies/)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/), [D1](https://developers.cloudflare.com/d1/reference/faq/)
- [Medusa modules](https://docs.medusajs.com/resources/commerce-modules), [Activepieces licensing](https://www.activepieces.com/docs/about/license), [Node-RED licensing](https://nodered.org/about/license/), [Nango ELv2](https://github.com/NangoHQ/nango/blob/master/LICENSE), [oauth4webapi](https://github.com/panva/oauth4webapi)
