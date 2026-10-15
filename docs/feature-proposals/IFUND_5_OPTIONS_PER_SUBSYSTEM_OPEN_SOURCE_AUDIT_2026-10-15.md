# IFund: Five-plus technology options per subsystem (19 areas, 101 evaluated paths)
**Research audit v2 · October 15, 2026 · DISCUSSION ONLY · no code installed, financial algorithms or deployments changed**

This extends [the initial open-source research](./OPEN_SOURCE_TWITCH_AUCTION_CONNECTOR_HOSTING_RESEARCH_2026-10-15.md), [the in-app Twitch concept](./twitch-in-app-livestream-concept.md), and [the auction/reward requirements](./donation-rewards-live-auctions-twitch.md).

## Reading this responsibly

- **Each functional area lists at least five options**, including existing IFund code when it is genuinely the best baseline. Some entries are implementation patterns or complementary components rather than independent products; they are marked.
- **OSS rights ≠ free hosting ≠ legal permission to run an auction or payment marketplace.** MIT/BSD/ISC/Apache generally permit commercial use with license-notice conditions. GPL/AGPL can be used commercially but bring distribution/network source requirements. Source-available terms and proprietary API agreements must be reviewed separately.
- Fit assessments are **engineering judgments, not proof of live integration**. No candidate has yet undergone IFund sandbox package-install/device/provider tests. Verify exact pinned release and transitive component licenses before copying into IFund.
- **Target contract:** Twitch carries video ingest and viewer CDN; users stay in IFund; Creator-defined rewards; item-auction payments segregated from standard donations; proposed 10% auction withdrawal/hosting fee instead of the standard 3% on those proceeds; legacy donation financial calculation remains untouched.
- **Authoritative stack audited:** `package.json` React 18 / Vite 6 / Capacitor 8.4.3, Base44 functions and verification scripts; `wrangler.toml` Cloudflare narrowly routed Worker; `host/gateway/README.md` Base44 authoritative data plane; `base44/shared/socialPublish.ts` native Bluesky and LinkedIn publishing with opt-in boundary.
- **Cost label:** Free OSS refers to *license cost*. Hosted free plan/SDK/API indicates possible $0 small-scale use, never guaranteed zero cost or SLA. PayPal, other gateways, taxes, registries, Google Play and domains may cost money. URLs are the exact provider/package documentation to recheck at installation time.

**Critical 2026 discoveries:** (1) Vendure current core is **GPLv3 since v3**, not MIT; see [Vendure license FAQ](https://vendure.io/licensing). (2) Medusa's [loyalty plugin was opened in April 2026](https://medusajs.com/blog/announcing-the-loyalty-plugin-for-medusa) but gift cards are not automatically donor incentives. (3) [Arctic was deprecated in July 2026](https://github.com/pilcrowonpaper/arctic). (4) [GitHub Pages disallows free hosting of an online business/ecommerce SaaS](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits); exclude as an IFund production host. (5) [PayPal multi-party platform APIs require partner approval](https://developer.paypal.com/platforms/get-started), independent of existing donation checkout. (6) [Cloudflare D1 Free quotas now hard fail](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/), so bids must gracefully stop safely at quota exhaustion.

## Research inventory


### 01 · Website UI, React routing, campaign pages and design system

**Current:** React 18, Vite 6, React Router 7, Radix and Tailwind  
**Leading direction:** Retain current React/Vite; reuse components

| Candidate / source | License or pricing rights | Fit | IFund decision / caveat |
|---|---|---|---|
| [React + Vite + existing UI](https://vite.dev/guide/) | MIT core packages | High | No migration; easiest safe extension; existing app tests already depend on its routes |
| [Next.js](https://nextjs.org/docs) | MIT framework | Medium | React-compatible, but requires new routing, server/build/deployment choices |
| [Remix / React Router framework](https://reactrouter.com/home) | MIT | Medium | Router already installed; framework conversion still high migration risk |
| [Astro islands with React](https://docs.astro.build/) | MIT | Medium | Excellent static marketing/help; less appropriate as whole interactive donation app |
| [SvelteKit](https://svelte.dev/docs/kit/introduction) | MIT | Low | Compelling performance but major React component replacement |

### 02 · IFund mobile/APK runtime

**Current:** Capacitor 8.4.3 Android paired with web app  
**Leading direction:** Retain Capacitor; native streaming plugin

| Candidate / source | License or pricing rights | Fit | IFund decision / caveat |
|---|---|---|---|
| [Capacitor (current)](https://capacitorjs.com/docs) | MIT OSS framework | Excellent | Reuses live web React and native Android APIs; smallest APK delta |
| [Tauri 2 mobile](https://v2.tauri.app/start/) | MIT/Apache-2.0 project components | Moderate | Promising smaller runtime but needs mobile rewrite/integration tests |
| [React Native](https://reactnative.dev/docs/getting-started) | MIT | Moderate | Good native media but requires replacing web React views with native equivalents |
| [Expo](https://docs.expo.dev/) | MIT core; hosted EAS may cost | Moderate | React Native development platform, not a zero-migration Capacitor plugin |
| [Flutter](https://docs.flutter.dev/) | BSD-3-Clause engine/framework | Low | Strong native media; full Dart UI rewrite makes it a poor fit now |

### 03 · Android camera/microphone to Twitch RTMP ingest

**Current:** No verified native streaming encoder; Twitch supplies video distribution  
**Leading direction:** RootEncoder or HaishinKit.kt in isolated Capacitor-native bridge

| Candidate / source | License or pricing rights | Fit | IFund decision / caveat |
|---|---|---|---|
| [RootEncoder](https://github.com/pedroSG94/RootEncoder) | Apache-2.0 | Excellent | Java/Kotlin; RTMP/RTSP/SRT; test Twitch RTMPS, reconnect and camera lifecycle |
| [HaishinKit.kt](https://docs.haishinkit.com/kt/latest/) | BSD-3-Clause | Excellent | Kotlin RTMP and audio/video mixing; good parallel benchmark vs RootEncoder |
| [Yasea](https://github.com/begeekmyfriend/yasea) | MIT | Moderate | Older Android RTMP client; maintenance and modern Android compatibility unverified |
| [GStreamer Android](https://gstreamer.freedesktop.org/documentation/frequently-asked-questions/licensing.html) | LGPL; dependent plugin licenses | Moderate | Mature media pipeline; considerably more build/ABI/license complexity |
| [FFmpeg native libraries](https://www.ffmpeg.org/legal.html) | LGPL by default; GPL depending on build | Low–moderate | Heavy native integration; strict license/codecs and binary provenance checks |

### 04 · Twitch video and chat inside web + APK

**Current:** Proposed in-app Twitch official playback; needs physical APK/WebView proof  
**Leading direction:** Official Twitch player + chat, IFund controls adjacent

| Candidate / source | License or pricing rights | Fit | IFund decision / caveat |
|---|---|---|---|
| [Official combined video+chat Twitch embed](https://dev.twitch.tv/docs/embed/) | Twitch service terms; not OSS | Excellent | Best single surface; HTTPS, parent domains, ad/player controls; APK test required |
| [Official Twitch video-only iframe/JS](https://dev.twitch.tv/docs/embed/video-and-clips/) | Twitch service terms; not OSS | Excellent | Use alongside responsive IFund Donate/Bid and separate chat panel |
| [Official standalone Twitch chat iframe](https://dev.twitch.tv/docs/embed/chat/) | Twitch service terms; not OSS | Good | Offers Twitch conversations but needs login/cookies moderation and an official player |
| [react-twitch-embed](https://www.npmjs.com/package/react-twitch-embed) | MIT wrapper; Twitch terms still apply | Good | React 18 friendly convenience; wrapper adds dependency, does not change policy |
| [Official Twitch VOD/Clips embed](https://dev.twitch.tv/docs/embed/video-and-clips/) | Twitch service terms; not OSS | Good supplementary | Playback while creator offline; not a live broadcast alternative |

### 05 · Twitch creator accounts, live status, chat and EventSub

**Current:** Base44 connector catalog offers Twitch but app-level creator connection not verified  
**Leading direction:** Twurple for API + official OAuth/EventSub, creator-scoped

| Candidate / source | License or pricing rights | Fit | IFund decision / caveat |
|---|---|---|---|
| [Twurple Auth + API packages](https://twurple.js.org/) | MIT | Excellent | Helix, refresh, users/channels; audit runtime size and token store |
| [Twitch Helix REST via native fetch](https://dev.twitch.tv/docs/api/) | Twitch API terms; no SDK license needed | Excellent | Leanest Worker route; implement state, token refresh, rate limits |
| [Twitch EventSub Webhooks](https://dev.twitch.tv/docs/eventsub/) | Twitch service terms | Excellent | Live/offline notifications server-side; signature and duplicate verification |
| [Twitch EventSub WebSockets](https://dev.twitch.tv/docs/eventsub/) | Twitch service terms | Good | Useful when persistent service already exists; serverless residency/quotas concern |
| [Twurple chat/EventSub modules](https://www.npmjs.com/package/@twurple/chat) | MIT | Good | Optional moderation/chat tooling; separate from video ingest and donor activity |

### 06 · Browser-based creator Go Live feasibility

**Current:** Android native stream-first; no free zero-relay browser publishing to Twitch confirmed  
**Leading direction:** Android-in-app direct RTMP; web camera broadcast later with explicit gateway decision

| Candidate / source | License or pricing rights | Fit | IFund decision / caveat |
|---|---|---|---|
| [Android native encoder to Twitch RTMP](https://dev.twitch.tv/docs/video-broadcast/) | Twitch service + permissive RootEncoder | Excellent Android / N/A browser | Meets no IFund relay but is NOT website camera broadcasting |
| [WebRTC WHIP browser to RTMP bridge](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API) | Browser API free; bridge hosting not free guaranteed | Conditional | Browser WebRTC typically needs ingest/relay/conversion before Twitch RTMP |
| [MediaRecorder chunks to converter](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) | Web standard free; gateway needed | Poor fit | Uploads live media through a conversion service; violates zero IFund relay if self-hosted |
| [ffmpeg.wasm browser conversion](https://ffmpegwasm.netlify.app/) | MIT wrapper; bundled FFmpeg licensing varies | Research only | Heavy CPU/battery; browser cannot open a normal RTMP TCP socket to Twitch |
| [OBS Studio / external creator app](https://obsproject.com/) | GPL-2.0-or-later | Technically proven but UX fails | Creator leaves IFund for broadcast; optional fallback, not preferred end state |

### 07 · Authoritative auction bid ordering + fanout

**Current:** No proven auction engine in main; high integrity needed  
**Leading direction:** Cloudflare SQLite-backed Durable Object per auction

| Candidate / source | License or pricing rights | Fit | IFund decision / caveat |
|---|---|---|---|
| [Cloudflare Durable Objects + WebSockets](https://developers.cloudflare.com/durable-objects/) | Managed service; free tier with limits; NOT open-source code | Excellent | Serialized accepted bids and closings without extra always-on server; test quota hard stops |
| [Socket.IO + owned Node server](https://socket.io/) | MIT code; server hosting cost | Good | Mature transport; must independently implement atomic bid arbiter and storage |
| [Centrifugo server](https://centrifugal.dev/) | Apache-2.0 code; always-on host needed | Good | Excellent event fanout; not itself a trustworthy single bid winner arbiter |
| [Supabase Realtime + Postgres](https://supabase.com/docs/guides/realtime) | Apache-2.0 realtime code; hosted quota/pausing | Moderate | Realtime channels with SQL transaction-based acceptance; new data plane |
| [PartyKit](https://docs.partykit.io/) | Open-source tooling with vendor Cloudflare-linked service terms | Moderate | Realtime rooms familiar model; inspect current package licenses/deployment assumptions |

### 08 · Auction catalog, buyer orders and seller fulfillment

**Current:** IFund has campaigns/donations but no verified seller-order subsystem  
**Leading direction:** IFund-native minimal auction state vs Medusa modules; compare in sandbox

| Candidate / source | License or pricing rights | Fit | IFund decision / caveat |
|---|---|---|---|
| [IFund-native separate auction/order entities](https://github.com/interplanetarysister/interplanetary-fund2) | Own code; no third-party engine license | Excellent initial fit | No new database or full commerce process; developer must build refunds/returns/fulfillment correctly |
| [Medusa v2 commerce modules](https://docs.medusajs.com/resources/commerce-modules) | MIT core; enterprise parts proprietary | Very good if service costs work | Products, inventory, orders, fulfillment and now loyalty; requires Node/DB for modules |
| [Spree Commerce core](https://spreecommerce.org/spree-commerce-licensing-bsd-3-clause-open-source-with-commercial-and-enterprise-options/) | BSD-3 core; some plugins AGPL/commercial | Moderate | Strong order/promotion/PayPal ecosystem; Ruby stack is different |
| [Saleor Core](https://github.com/saleor/saleor) | BSD-3 core; some add-ons different | Moderate | GraphQL/Python/Postgres makes bigger operational footprint |
| [Sylius core](https://github.com/Sylius/Sylius) | MIT core; Plus proprietary | Low–moderate | Featureful PHP/Symfony ecommerce; larger migration and hosting footprint |
| [Vendure core](https://vendure.io/licensing) | GPLv3 for current core; commercial alternative | Moderate technically, legal caution | Excellent TypeScript plugins but GPL redistribution obligations and DB service |

### 09 · Creator-defined donation rewards, inventory, fulfillment

**Current:** Social banner rewards exist but are unrelated to promised donor incentives  
**Leading direction:** Minimal IFund reward catalog; benchmark Medusa loyalty

| Candidate / source | License or pricing rights | Fit | IFund decision / caveat |
|---|---|---|---|
| [IFund-native reward offers and fulfillment](https://github.com/interplanetarysister/interplanetary-fund2) | Own code | Excellent | Creator-scoped offers, eligibility, quantity, claim/ship status; no commerce dependency |
| [Medusa Loyalty/Store Credit modules](https://docs.medusajs.com/resources/commerce-modules/loyalty) | MIT core/plugin released OSS in 2026; verify package | Very good for gift cards | Does NOT itself solve charitable contribution/quid pro quo classification |
| [Spree promotion/reward rules](https://spreecommerce.org/spree-5-open-source-ecommerce-advanced-promotions-engine/) | BSD-3 core | Good for sales; moderate for donation | Rules, coupons, free items; doesn't model IFund donation-based promises |
| [Saleor promotion rules](https://docs.saleor.io/developer/discounts/promotions) | BSD-3 core | Moderate | Catalog/order promos, not donor reward fulfillment natively |
| [Vendure promotions](https://docs.vendure.io/current/core/core-concepts/promotions) | GPLv3 core | Moderate | Configurable conditions/actions; redistribution license & server cost caution |

### 10 · Payments, holding, marketplace seller approval and auctions

**Current:** Existing verified PayPal Business and canonical ledger; Stripe excluded by owner decision  
**Leading direction:** Keep PayPal donation flow; obtain explicit provider approval for item sales/marketplace before auction transactions

| Candidate / source | License or pricing rights | Fit | IFund decision / caveat |
|---|---|---|---|
| [Existing IFund PayPal checkout + finance ledger](https://developer.paypal.com/docs/checkout/) | PayPal SDK/API terms; processing fees | Excellent for existing donations | Do not touch historical allocations; auction sales separate and only if provider approves |
| [PayPal Complete Payments Platform (multiparty)](https://developer.paypal.com/platforms/get-started) | Proprietary provider; approval required | Potentially best auction rails | Explicit PayPal partner approval required for live marketplace platform APIs |
| [Square developer APIs](https://developer.squareup.com/reference/square) | Proprietary processor; fees and approval | Possible seller payments alternative | Per-seller OAuth doesn't automatically permit IFund's pooled withdrawal model |
| [Adyen for Platforms](https://docs.adyen.com/marketplaces/) | Proprietary payment service; contracts/fees | Strong infrastructure, expensive/complex | Split payments, balance accounts and compliance; commercial approval |
| [Mangopay wallets/payouts](https://docs.mangopay.com/guides/fees) | Proprietary service; contracts/fees/KYC | Strong marketplace fit, uncertain US eligibility | Wallet/fee rails differ from IFund ledger; do not migrate without legal provider review |
| [Wix Payments API (read-only payouts)](https://dev.wix.com/docs/api-reference/business-management/payments/wix-payments-provider/payouts/introduction) | Proprietary; Wix business terms | Limited | Current Payouts API is READ-ONLY; not a direct IFund withdrawals replacement |

### 11 · Per-user OAuth / account-connection protocol implementation

**Current:** Base44 app-user managed connection architecture must preserve account ownership  
**Leading direction:** Use current owner-scoped auth; evaluate oauth4webapi for new providers

| Candidate / source | License or pricing rights | Fit | IFund decision / caveat |
|---|---|---|---|
| [oauth4webapi](https://www.npmjs.com/package/oauth4webapi) | MIT | Excellent | Web Standards; Cloudflare Worker and Node 20+; low-level but auditable |
| [openid-client](https://github.com/panva/openid-client) | MIT | Good | Higher-level OIDC/OAuth; may be bigger than Twitch use case |
| [Auth.js](https://authjs.dev/) | ISC core; verify per adapter | Moderate | Useful login/session ecosystem; replacing Base44 login unnecessary |
| [Nango community self-host](https://github.com/NangoHQ/nango/blob/master/LICENSE) | Elastic License 2.0, source-available not OSI | Conditional | Embedding may be allowed if not exposing Nango as managed competing service; verify exact rights and self-host costs |
| [Arctic OAuth library (deprecated Jul 2026)](https://github.com/pilcrowonpaper/arctic) | MIT but DEPRECATED | Low / reject for new code | Reference only; deprecation makes it an unsafe new dependency |

### 12 · Cross-platform publishing and request-triggered automations

**Current:** Native Bluesky/LinkedIn adapters and consent gates; external fund sync must be triggered on request  
**Leading direction:** Retain native adapters; evaluate Activepieces core for approved narrow tasks

| Candidate / source | License or pricing rights | Fit | IFund decision / caveat |
|---|---|---|---|
| [Existing IFund native provider adapters](https://github.com/interplanetarysister/interplanetary-fund2) | Owned code | Excellent | Known authorization/SSRF boundaries, no new always-on runtime |
| [Activepieces Community core](https://www.activepieces.com/docs/about/license) | MIT core; embedded/white-label EE features paid | Good limited pilot | Connector catalog; server/queue/db costs; do not assume embedded builder is free |
| [Node-RED](https://nodered.org/about/license/) | Apache-2.0 | Good admin tooling | Flexible flows but per-user secrets and always-on host need hardening |
| [Temporal self-hosted](https://docs.temporal.io/self-hosted-guide) | MIT server; runtime must be hosted | Good durable jobs, heavy | Event workflows and retries; heavy for small IFund |
| [Windmill community](https://www.windmill.dev/platform/self-host) | AGPLv3, enterprise separate | Moderate | Script/workflow UI; network copyleft and hosting/legal review before embedding |
| [n8n community](https://support.n8n.io/article/can-i-use-your-license-for-my-use-case) | Sustainable Use License not OSI OSS | Poor without commercial license | Letting IFund customers configure workflows generally requires commercial license |

### 13 · Web hosting/edge functions and routing

**Current:** Base44 live site plus Cloudflare Worker path gateway; do not assume all routes deployed  
**Leading direction:** Retain Base44 + existing Cloudflare Worker routes; evaluate extra paths in clone

| Candidate / source | License or pricing rights | Fit | IFund decision / caveat |
|---|---|---|---|
| [Existing Base44 site publishing](https://docs.base44.com/) | Proprietary hosted service | Excellent low-migration | Current app/backend integration; depends on platform plan and deployments |
| [Cloudflare Workers + static assets/Pages](https://developers.cloudflare.com/workers/platform/pricing/) | Proprietary hosting, free quota | Excellent for targeted edge routes | Already in wrangler.toml; update routes/auth/CSP/cost caps only after tests |
| [Deno Deploy](https://deno.com/deploy/pricing) | Proprietary hosting, free plan | Good portable edge fallback | Current published free request/egress caps; deploy separately if justified |
| [Firebase Hosting + Functions](https://firebase.google.com/pricing) | Proprietary hosted service; free hosting tier, compute billing caveats | Moderate | SDK already in app; avoid duplicating auth/data planes |
| [Netlify static/functions](https://www.netlify.com/pricing/) | Proprietary hosting with plan limitations | Moderate | React static hosting fits; function quotas and commercial-plan requirements must be checked |

### 14 · Auction nonfinancial state / database

**Current:** Base44 is authoritative for users/campaigns/payment money; only new nonfinancial state under evaluation  
**Leading direction:** DO SQLite for atomic live bids + Base44 durable business records; avoid duplicate finance authority

| Candidate / source | License or pricing rights | Fit | IFund decision / caveat |
|---|---|---|---|
| [Existing Base44 entities](https://docs.base44.com/) | Proprietary app backend | Excellent for product records | Minimize new services; don't assume cross-entity atomic bidding exists |
| [Cloudflare Durable Objects SQLite](https://developers.cloudflare.com/durable-objects/) | Hosted quota, not OSS | Excellent bid state | One auction = one serial writer; alarm/WebSocket hibernation |
| [Cloudflare D1 SQLite](https://developers.cloudflare.com/d1/platform/pricing/) | Hosted free hard caps | Good catalog/index | Free limit failures after quota; not sole real-time arbiter |
| [Supabase Postgres](https://supabase.com/docs/guides/platform/free-project-pausing) | Postgres OSS; hosted free tier pauses inactivity | Good but extra plane | Relational constraints/row locks; paid needed for inactivity-sensitive production |
| [Neon serverless Postgres](https://neon.com/pricing) | Postgres OSS; proprietary free hosting tier | Good service fallback | Free quotas/compute sleep; more sync complexity |

### 15 · Auction item pictures, campaign media and file delivery

**Current:** IFund already has Base44-owned image uploading/storage; no Twitch video relay wanted  
**Leading direction:** Retain IFund asset storage; use Twitch for video distribution, optional R2 for authorized item photos

| Candidate / source | License or pricing rights | Fit | IFund decision / caveat |
|---|---|---|---|
| [Existing Base44 media storage](https://docs.base44.com/) | Proprietary platform | Excellent initial | No migration; maintain ownership/permission/rights |
| [Cloudflare R2 object storage](https://developers.cloudflare.com/r2/pricing/) | Proprietary service with free quota | Excellent later | Media asset upload; signed access/limits; NOT Twitch livestream storage |
| [Supabase Storage](https://supabase.com/pricing) | OSS APIs + hosted free/paid quotas | Moderate | New user permissions and media backend |
| [Cloudinary free plan](https://cloudinary.com/pricing) | Proprietary asset SaaS; free tier limits | Good image transforms | Transformation credits/limits; user item rights remain IFund policy issue |
| [Self-hosted MinIO object storage](https://github.com/minio/minio) | License/version varies; recent AGPL/commercial and maintenance changes—CHECK | Low | Avoid relying on unverified future package license/version or free always-on server |

### 16 · Legal-help center, knowledge base, public blogs/media

**Current:** Existing IFund website Help Center; APK links to site to stay small  
**Leading direction:** Keep existing Help pages; optionally use Astro or Docusaurus to compile web-only articles

| Candidate / source | License or pricing rights | Fit | IFund decision / caveat |
|---|---|---|---|
| [Existing IFund Help Center pages](https://github.com/interplanetarysister/interplanetary-fund2) | Owned source | Excellent | Already connected to app links; minimal new dependencies |
| [Docusaurus](https://docusaurus.io/) | MIT | Good | React docs, MDX, searchable static content; new build surface |
| [Astro content collections](https://docs.astro.build/en/guides/content-collections/) | MIT | Excellent for standalone web articles | Small static payload, accessible content, optional future article renderer |
| [MkDocs](https://www.mkdocs.org/about/license/) | BSD-2-Clause | Good | Simple static Markdown build but introduces Python toolchain |
| [BookStack](https://www.bookstackapp.com/about/project-faq/) | MIT | Moderate | Rich knowledge-base editor; needs PHP/MySQL always-on server |
| [VitePress](https://vitepress.dev/) | MIT | Moderate | Beautiful docs but Vue UI not current React ecosystem |

### 17 · Bid protection, authorization, abuse and audit trail

**Current:** Existing account and financial authorization guards; auction trust boundary not built  
**Leading direction:** Keep canonical role checks + Turnstile/rate limits + server-authoritative bid acceptance

| Candidate / source | License or pricing rights | Fit | IFund decision / caveat |
|---|---|---|---|
| [Existing IFund account/financial guards](https://github.com/interplanetarysister/interplanetary-fund2) | Owned code | Excellent | Do not replace server-side ownership with client-only toggles |
| [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/plans/) | Proprietary challenge service; free production plan | Excellent supplement | Bot challenge; not identity proof or bid integrity |
| [rate-limiter-flexible](https://www.npmjs.com/package/rate-limiter-flexible) | ISC | Very good Node/DB lane | Limits attempts; verify Worker runtime adapter and atomic backend |
| [OpenFGA](https://openfga.dev/) | Apache-2.0 project | Good at scale | Fine-grained creator/auctioneer/bidder permissions; adds server |
| [Open Policy Agent](https://www.openpolicyagent.org/docs) | Apache-2.0 project | Moderate | Policy-as-code for prohibited seller/item rules; heavier operations |
| [OWASP Core Rule Set](https://coreruleset.org/) | Apache-2.0 project | Supplemental | WAF patterns, not protection from shill bidding or payment reversals |

### 18 · Agents, recurring jobs, backend observability

**Current:** Base44 agents/workflows and GitHub CI already exist; eliminate redundant polling  
**Leading direction:** Keep Base44/GitHub triggered workflows; add instrumentation before new job engine

| Candidate / source | License or pricing rights | Fit | IFund decision / caveat |
|---|---|---|---|
| [Existing Base44 agents + GitHub Actions](https://docs.github.com/en/actions) | Service terms, existing costs/quotas | Excellent | Owner-authorized triggers; no redundant scheduler; preserve finance authority |
| [Cloudflare Workflows](https://developers.cloudflare.com/workflows/) | Managed service, plan quotas; not OSS | Good targeted orchestration | Edge-friendly future callbacks/retries; separate deployment rights |
| [Temporal server + SDK](https://docs.temporal.io/self-hosted-guide) | MIT server | Good complex jobs, high overhead | Durable retries and compensation; requires hosted workers and DB |
| [Trigger.dev core](https://github.com/triggerdotdev/trigger.dev) | Open-source components; review per-package Apache/commercial license | Good Node workflows | Current repo uses Node 24; check runtime and self-host costs |
| [OpenTelemetry JS](https://github.com/open-telemetry/opentelemetry-js) | Apache-2.0 | Excellent instrumentation only | Traces across Twitch/auction/payment without exposing tokens; NOT a job engine |
| [Pino logs](https://www.npmjs.com/package/pino) | MIT | Excellent instrumentation only | Structured privacy-safe logs with retention policy; NOT a job engine |

### 19 · Icons, visual UI assets, accessible patterns

**Current:** Space-comic blue/purple IFund design; existing Lucide and Radix  
**Leading direction:** Keep existing brand art + Lucide/Radix; no stock images or trademark cloning

| Candidate / source | License or pricing rights | Fit | IFund decision / caveat |
|---|---|---|---|
| [Existing Lucide icons](https://lucide.dev/license) | ISC plus Feather-derived MIT notices | Excellent | Already installed; preserve license/notice, no Twitch brand logo sublicense |
| [Heroicons](https://heroicons.com/) | MIT | Good alternative | Great clean icons but another dependency duplicates Lucide |
| [Tabler Icons](https://tabler.io/icons) | MIT | Good alternative | Large icon set; alternative not required |
| [Phosphor Icons](https://phosphoricons.com/) | MIT | Good alternative | Expressive icon weights; performance tradeoff to measure |
| [Google Material Symbols](https://developers.google.com/fonts/docs/material_symbols) | Apache-2.0 | Good alternative | Broad accessibility glyphs; font bundle constraints and attribution checks |

## Shortlist: which options are truly the most promising?

| First proof | Chosen experiment | Why the other choices lose initially | Mandatory stop condition |
|---|---|---|---|
| Twitch watching | Official Twitch video/chat embedded into existing React screen | React wrapper adds little; building a media player violates vendor rules | APK WebView or iframe cannot honor Twitch embedding requirements |
| Android creator Go Live | RootEncoder **versus** HaishinKit.kt, both native-only modules | FFmpeg/GStreamer are heavier, Yasea looks older | Twitch rejects ingest; stream key leaks; reconnect/drain/background lifecycle fails |
| Twitch per-creator connection | Twurple + official OAuth, compare lean native Helix fetch | Avoid new general auth system until required | Auth token crosses owners or consent/refresh invalid |
| Bid engine | Cloudflare Durable Object in isolated worker | Socket.IO/Centrifugo need always-on hosting; do not own financial authority | Any two conflicting accepted winners, stale bid or free quota unsafe behavior |
| Catalog, order, delivery | **Head-to-head IFund-native vs Medusa MIT modules** | Ruby/PHP/Python commerce stacks add a second large runtime; Vendure GPLv3 | Cannot cleanly keep auction purchase separate from donation ledger |
| Rewards | IFund reward offer entities vs Medusa loyalty plugins | Generic store discounts are not fundraising fulfillment | Promised item treated as fulfilled or tax-deductible before verification |
| Platform connectors | Existing IFund connections vs Activepieces MIT-core pilot | No license/cost evidence that wholesale replacement is better | Creator consent not verifiable, unauthorized external write, 24/7 costs |
| Hosting | Existing Base44 + narrow Cloudflare Worker routes | No reason to reintroduce non-authoritative platforms | Unexpected DNS, auth, data-plane, or free-quota failure |

## Medusa versus IFund-native comparison — research stage only

| Test axis | IFund-native auction | Medusa MIT commerce modules | Current read |
|---|---|---|---|
| Integration with existing React screens | Direct reusable React components | API integration; existing UI can remain | **IFund-native easier** |
| Node and hosting | No new always-on Node service if auction state lives in DO/Base44 | Medusa can run as Node or serverless module but DB, module wiring, versions and likely PostgreSQL add complexity | **IFund-native easier now** |
| Auction-specific bidding | Must be built, server-authoritative | **Also must be built**; Medusa core is commerce, not bid matching | Tie |
| Order/refund/fulfillment maturity | New code and tests required | Prebuilt order/fulfillment/inventory services | **Medusa stronger** |
| Creator loyalty/gift-card inventory | Define exactly donor-specific claim/quantity | 2026 loyalty/store-credit module available, but sale-oriented | Medusa advantage on gift cards only |
| Existing PayPal gift ledger preservation | Isolate sale events and keep original ledger | Requires bridge anyway; cannot replace canonical IFund donation account | **IFund-native lower risk** |
| Fee correctness | Distinct 10% auction withdrawal fee must be coded | Same IFund-specific fee must be coded in bridge | Tie |
| Seller legal/payment onboarding | Counsel/provider approval regardless | Same requirement; software cannot confer license | Tie |
| Near-$0 running cost | Likely lowest if small traffic under existing cloud quotas | Free source but separate DB/compute likely adds operating costs | **IFund-native lower cost** |
| Long-term complex physical inventory/returns | Larger engineering burden | Reusable mature commerce primitives | **Medusa likely wins at scale** |

**Provisional choice:** Start with an **IFund-native five-state auction prototype** `draft -> live -> closed_pending_payment -> paid_and_creditable -> fulfilled_or_disputed`, with a Cloudflare DO bid arbiter and mocked purchases. In a separate throwaway clone, wire **Medusa Orders/Product/Inventory modules** to the *same* fake fixtures and score effort, correctness, Node 20+ compatibility, software licenses and operational expenses. **Do not merge either into main yet.** This preserves the user's ability to replace the auction subservice later without rebuilding the platform.

## Legal and operational vetoes

1. Before any source reuse, pin exact version/commit, inspect `LICENSE`, `NOTICE`, package registry, SBOM/transitive licenses, current maintainer/security history, and trademark/media rights; put required notices in IFund web/APK. No source license = no right to copy.
2. A video/player API usable for free is not open-source code and is governed by Twitch terms. Never implement a Twitch Extension in-stream purchase control contrary to provider policy. Official IFund controls sit **beside** Twitch video; preserve ads and official player.
3. Payment SDK availability is NOT approval to run auction marketplace funds, buy/sell goods, or hold/distribute payouts. Do not turn ordinary donations into auction sale records. Require seller onboarding, dispute refunds, lawful auctions, shipping/tax, consumer protection, restricted items and processor approval.
4. The proposed **10% auction hosting fee** is measured at auction proceeds withdrawal and must **not stack** with 3% ordinary gift withdrawal fee on the same auction amount. Keep donor's separately opted 10% gift support concept distinct. Existing historical PayPal money path stays immutable.
5. Schedulers, marketing, social writing and creator credentials must operate only within owner-approved scope. External **fundraising sync stays request-triggered**, not periodic. Preserve the fail-closed Mastodon SSRF gate.
6. Cloudflare Workers/D1/DO have usage limits, not guaranteed free unlimited production. A quota failure must **fail closed** for auction bidding and payment acceptance, never accept unrecorded bids or imply success.

## Sources beyond GitHub (checked in this research)

Official **Twitch Developer docs**, **Cloudflare pricing and changelog**, **PayPal Developer**, **Wix Developer Payouts API**, **Square Developer**, **Adyen Marketplace**, **Mangopay Docs**, **npm package registry**, **HaishinKit API docs/JitPack**, **GStreamer and FFmpeg licensing**, **Medusa docs**, **Vendure licensing FAQ**, **Spree licensing policy**, **Supabase docs**, **Deno Deploy pricing**, **Activepieces license docs**, **Node-RED license**, **n8n's license clarification**, **FTC/WA regulatory sources linked in the earlier concept**. Individual source links are next to every candidate.

## Status and next steps

- This is **research only**: no packages imported, live services added, creator accounts connected, payments changed, or source code replaced.
- Before implementation, produce a per-choice license/notice register, inspect exact published tags and test Node 20+ install, build size, backend environment feasibility, APK camera/RTMP/Twitch verification, web embedding, idempotent bid state, privacy and physical-item sale approvals in an isolated clone.
- Only request a **code replacement decision** after prototype comparison shows materially better capability, operation cost and safety; no wholesale migration of IFund or its existing donation ledger.
