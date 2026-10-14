# Future concept: livestream fundraising and live auctions

**Status:** IDEA / FUTURE ROADMAP — not implemented or approved for production  
**Proposed by:** IFund founder  
**Recorded:** 2026-10-13  
**Scope:** Interplanetary Fund campaign pages, connected creator streams, donating and live fundraising events  
**Delivery rule:** This is documentation for a `future/` branch only. Do not merge, deploy, alter live code, or change payment and donation accounting as part of recording this idea.

## 1. Twitch-connected campaign livestreams and donations

### Founder intent
A campaign creator should be able to connect a Twitch livestream to their IFund campaign. Alternatively, a connected Twitch stream should give viewers an easy way to donate to an IFund campaign *while they watch Twitch*, preferably by tapping a donation icon without leaving the stream. Viewers should be able to follow a link from the donation experience to the underlying IFund campaign, learn more about the cause, and see where their donation was credited.

### Desired experiences
1. **IFund campaign page:** campaign creators connect their Twitch account and associate their live channel/broadcast with a specific campaign. When live, display a playable stream alongside campaign information and a clear **Donate** action. When offline, show an appropriate non-live state and campaign information.
2. **On Twitch:** show an unobtrusive campaign donation icon, panel, overlay, or Twitch Extension (whichever Twitch legitimately permits). Aim for an in-context, no-stream-interruption donation flow. Keep viewers on Twitch during the experience wherever technically and policy-permitted.
3. **Donation destination:** every donation started from a creator's connected livestream must be tied to the intended IFund campaign; after donating, the supporter can open that campaign to learn about the beneficiary, progress, and updates.
4. **Creator controls:** link/unlink Twitch, choose a campaign, switch the campaign that a future stream promotes, turn the Twitch fundraising feature on/off, and see clear connection state.
5. **Accessibility and parity:** mobile web, mobile app and desktop web should support appropriate alternatives, and controls should be understandable to nontechnical users.

### Feasibility to investigate before implementation
- Twitch authentication, live status APIs, supported player embedding, Twitch Extension capabilities and review policies, link-out and payment restrictions.
- Whether a Twitch-hosted donation widget can *actually* handle payment without a separate browser page. If not, use the shortest compliant route to IFund checkout rather than promise no exit.
- Domain/iframe/CSP requirements for an embedded Twitch player and permission to embed on IFund domains.
- Attribution and callbacks linking the viewing channel, IFund campaign, donation attempt and verified provider payment.
- Existing IFund catalog lists Twitch as an APP_USER OAuth connector prospect; that catalog entry is **not** proof of successful authorization or end-to-end donations.

### Definition of success
- Creator authorizes Twitch using approved provider flow and binds it to a campaign.
- A viewer can watch or reach a stream, use an obvious Donate action, and understand which cause receives funds.
- Only verified completed donations enter the existing campaign ledger/totals; canceled, failed or duplicate callbacks cannot invent donations.
- After donating, the viewer can navigate to the IFund campaign and read its details.
- Working experiences are tested on both website and app before any production proposal.

## 2. Livestream fundraising auctions (artwork, goods and more)

### Founder intent
Supporters, creators and approved organizers should be able to link a livestream or live video to an auction for artwork, physical goods or other suitable items. The funds raised can benefit charities, individual causes, emergencies, and other qualifying IFund campaigns.

### Desired experiences
1. **Create an event:** associate a live auction with an IFund campaign, add item photos/descriptions, condition, relevant provenance, minimum/starting bid, bidding increments, shipping or pickup, and sale/beneficiary disclosures.
2. **Go live:** attach a live video feed (first explore connected Twitch/external streams; support other approved stream providers later), show the current item, price, countdown, bidder updates, and a direct link to the campaign receiving proceeds.
3. **Bid during the stream:** eligible viewers can submit live bids, receive clear outbid/winning information and see countdown changes. Ensure server-authoritative bids, race handling, anti-bot/fraud measures and a traceable bid history. Chat/comment participation is optional and moderated.
4. **Settle responsibly:** reserve or collect payment through a supported, approved processor once the auction outcome is final; state clearly what portion is donated and when funds are credited to the beneficiary campaign. Record sale proceeds, donations, fees, refunds and chargebacks distinctly where required.
5. **Follow through:** winning bidder receives purchase/payment and fulfillment instructions; organizer tracks delivery or pickup, returns, disputes and cancellations. Provide appropriate donor/receipt records and the IFund campaign link.
6. **Alternatives:** a simple watch-and-bid view on IFund for people who do not use Twitch; accessible mobile layouts; fallback when the livestream ends or disconnects.

### Definition of success
- A campaign can host a test live auction without exposing the main branch or production financial flows.
- Multiple concurrent bidders cannot create conflicting winners; the highest valid final bid wins under clearly communicated auction rules.
- Items, bidders, organizers and beneficiaries are traceable for dispute resolution and fraud prevention.
- Each verified payment is credited to its intended campaign using IFund's existing authorized payment-handling and ledger procedures; no unauthorized changes to current processing/recording algorithms.
- Beneficiary designation and whether a purchase is tax-deductible are clearly disclosed; avoid calling ordinary sales charitable donations without proper legal basis.
- Both website and app receive matching user-facing functionality once independently tested and explicitly approved.

## Shared implementation investigation and safeguards

- **Integrations:** research Twitch's official APIs/Extensions and an approved video embed/link strategy first; look for maintained, appropriately licensed open-source alternatives before writing custom components.
- **Payments:** reuse existing approved IFund donation/payment flow and its verification/ledger behavior. **Do not rewrite, replace, deduplicate, or otherwise alter existing financial algorithms** solely to enable these ideas. Treat any new settlement or auction-specific processing as separately scoped and explicitly reviewed.
- **Security:** creator permission and consent; server-side authorization; webhook signature verification where relevant; protection against duplicate or spoofed payments; non-public user data kept private; moderation and misuse reporting.
- **Auction requirements:** investigate tax/charitable-solicitation, auction, consumer-protection, fee disclosure and payment-provider rules in applicable jurisdictions before launch.
- **Operational safety:** work on cloned/test branches, demonstrate isolated tests, inspect UX and financial results before requesting a future PR; nothing auto-merges into `main`.
- **Provider truthfulness:** provider-specific constraints are to be tested and recorded; do not describe Twitch donation overlays or livestream auctions as working until provider-backed verification exists.

## Suggested future milestones

1. **Research and prototype:** document Twitch provider capabilities and policy limits; mock campaign embed and donate entry points. No real payments.
2. **Twitch campaign donation MVP:** opt-in streamer link + IFund campaign embed + compliant on-stream donation entry path + verified payment attribution.
3. **Auction prototype:** stream-linked auction listings, server-authoritative bidding, clocks and settlement simulation in a test environment.
4. **Auction launch readiness:** legal/provider review, payment/beneficiary verification, fraud/dispute handling, fulfillment and cross-platform usability tests.
5. **Release decision:** founder review of tested changes before any proposal to merge with publishable software.

*Roadmap only. No production feature or provider authorization has been created by this document.*
