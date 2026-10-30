# Content interoperability and provider compliance audit
Updated: 2026-10-30

## Scope and evidence standard

This audit distinguishes provider API capability from IFund runtime capability. A platform appearing in the Connections catalog, an OAuth grant, a saved URL, or a stored capability row does not prove a working import, publish, comment, or reply route. IFund may mark an operation active only after a real provider request succeeds under the connected owner's identity and scope.

## Added connection options

- **Tumblr**: OAuth 2.0 connector slot and identity verification probe are present. IFund still needs its registered Tumblr developer application, redirect URL, OAuth scopes, connector registration, and end-to-end tests. Tumblr documents OAuth 2.0 bearer tokens and the `basic`, `write`, and `offline_access` scopes. Publishing and reblogging are supported by the provider API, subject to its developer agreement and rate limits. IFund has not implemented a Tumblr publishing adapter, so do not advertise direct publishing as live.
- **WordPress.com**: already existed as an OAuth catalog entry and connector mapping. The official API supports posts, pages, media, comments, and other site resources with granular scopes. IFund's current connection verification can confirm the WordPress.com identity, but that alone does not prove post creation. The current direct-publish adapter does not include WordPress.com.
- **WordPress.org (self-hosted)**: added as a distinct connection type. The UI accepts the site URL, username, and a dedicated Application Password. The password is encrypted before storage and redacted on reads. It is not yet provider-verified; do not show it as connected or use it to publish. A secure outbound-site validation layer is required before calling arbitrary user-supplied site hosts, to prevent SSRF and redirect/DNS rebinding.
- **Ghost**: added as a distinct connection type. The UI accepts a publication URL and dedicated Admin API key; the key is encrypted before storage and redacted on reads. It is not yet provider-verified or publish-enabled. Ghost's Content API is public/read-only; publishing requires the Admin API and a signed server-side request. A secure outbound-site validation layer is required before contacting arbitrary user-supplied Ghost hosts.

## Current social publishing runtime

The source audit of `base44/shared/socialPublish.ts` shows direct publishing adapters for:
- Bluesky: app-password session plus post creation.
- LinkedIn: owner-authorized OAuth connector and member-post permission.

Mastodon explicitly fails closed because arbitrary instance URLs require DNS-pinned, redirect-safe transport. The newly added Tumblr, WordPress.org, Ghost, and existing WordPress.com entries do not yet have direct-publish adapters. A provider connection or identity probe is not equivalent to publish capability.

The remaining social catalog entries include Facebook Pages, Instagram, Threads, X, TikTok, Pinterest, Reddit, YouTube, Discord, and Mastodon. Their API permissions and account types differ; profile identity alone does not establish Page posting, media publishing, comment ingestion, or messaging permission. Each operation must be scoped and tested separately. Several catalog entries are link-only rather than API connections. Keep them link-only until a provider-approved adapter is implemented.

## Mutual-sharing model

For each provider, implement distinct capability flags and tests rather than a single "connected" boolean:

1. **IFund → provider**: create draft; publish only after owner action/consent; edit/delete only when explicitly supported and granted.
2. **Provider → IFund**: import only provider-authorized posts/media/metadata; retain source URL, provider ID, owner, timestamps, and provenance.
3. **Conversation sync**: comments, replies, and DMs are separate scopes/endpoints; never infer them from post access.
4. **Media**: check provider-specific formats, size limits, attribution, licensing, and upload scopes.
5. **Engagement**: likes, shares, reblogs, views, and donor totals are separate metrics with distinct freshness and provenance.
6. **Webhooks**: verify signatures, deduplicate event IDs, constrain payload sizes, and store only minimum necessary data.
7. **Revocation**: stop scheduled actions immediately when a grant is revoked, expires, or loses a required scope.

Do not silently mirror every external post in both directions. Require per-account and per-content consent, prevent loops with provider IDs and idempotency keys, preserve canonical links/attribution, and let owners choose which campaigns and content types may cross-post.

## Security and compliance gates

- Store user tokens and API keys only in encrypted server-side credential storage; never expose them in browser state, logs, public entities, or analytics.
- Use the least-privilege provider scopes. Keep WordPress.com scopes narrow (for example, posts/media only where required); avoid broad/global access.
- Tumblr API credentials must belong to IFund's registered developer application. Respect its developer/API agreement, community rules, rate limits, and per-user post/media caps. Do not scrape or automate around the official API.
- WordPress self-hosted credentials must be dedicated, revocable Application Passwords sent only over HTTPS. Never request the user's main password.
- Ghost Admin API keys are privileged secrets. Keep them server-side; never substitute the public Content API key for write access.
- Validate external hosts with an SSRF-safe egress mechanism before server requests. Reject private, loopback, link-local, metadata, non-HTTPS, credential-bearing, and unsafe redirect destinations.
- Keep automation opt-in, draft-first by default, owner-scoped, auditable, rate-limited, and idempotent. Never post to a user's account using an IFund administrator's identity.
- Respect each platform's spam, automation, content, copyright, trademark, and API-use policies. Do not claim provider endorsement or imply that external funds are held by IFund.

## Verification status

- Catalog options added: Tumblr, WordPress.org (self-hosted), Ghost.
- WordPress.com retained as the existing separate OAuth option.
- New WordPress.org and Ghost secrets are included in the encrypted-secret allowlist and redaction contract.
- Tumblr identity verification is implemented as a read-only provider probe, but it is not live until the Tumblr connector is registered and a real user authorization is tested.
- No new end-to-end provider publishing test was possible in this source-only change. These new connections must remain unverified / non-publishing until credentials, safe outbound transport, and live tests are in place.
- The Base44 app sandbox is unavailable on the connected workspace's current plan, so this branch has not been built or run in the Base44 sandbox. Do not merge or call this production-ready until the normal CI/build and account-level provider tests pass.

## Official provider references

- Tumblr developer resources: https://help.tumblr.com/knowledge-base/developer-resources/
- Tumblr API documentation and developer agreement: https://github.com/tumblr/docs
- WordPress.com OAuth scopes: https://developer.wordpress.com/docs/api/oauth2/
- WordPress REST posts endpoint: https://developer.wordpress.org/rest-api/reference/posts/
- WordPress Application Passwords: https://developer.wordpress.org/advanced-administration/security/application-passwords/
- Ghost Content API: https://ghost.org/docs/content-api/
- Ghost custom integrations and Admin API keys: https://ghost.org/integrations/custom-integrations/
