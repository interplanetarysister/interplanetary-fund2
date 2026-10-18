# Instagram Platform integration runbook (18 October 2026)

## Status and ownership
IFund's existing app-user OAuth flow uses `base44/connectors/instagram.jsonc`, `getAppUserConnector`, `finalizeAppUserOAuthConnection`, and `verifyPlatformConnection`. This change requests missing Instagram permissions but **does not establish a live Meta-approved connection**. Account identity, authenticated read, publishing, and messaging must each be tested with a real connected professional account. Maintain the one account-level AI delegation toggle and honor revocation.

## Authentication choice
- Default: **Instagram API with Instagram Login**, for Instagram Business/Creator accounts; no Facebook Page required. Instagram professional authorization belongs to the account owner and uses `instagram_business_*` permissions.
- Alternative: **Instagram API with Facebook Login** for professional accounts linked to a Facebook Page; requires the separate Facebook/Page permissions and Facebook/Page token flow. Do not substitute Facebook Login tokens or scopes for Instagram Login tokens.
- Consumer/personal Instagram accounts cannot access these professional API operations; offer user-driven native sharing instead, without claiming automated posting.
- IFund-owned Instagram brand account must authorize the same way, through its actual account owner. Do not mark a platform-owned account active until token and provider read/write checks succeed.

## Requested Instagram Login scopes
- `instagram_business_basic`: account and media
- `instagram_business_content_publish`: publish eligible media
- `instagram_business_manage_comments`: read/moderate/reply to comments
- `instagram_business_manage_messages`: eligible conversation messaging
- `instagram_business_manage_insights`: supported metrics/insights

Scope requests are not grants. Keep provider-reported permissions separate from intended IFund agent capabilities; errors and denied scopes must leave individual operations disabled.

## Meta setup checklist
1. Create/select a Meta Developer app with Instagram product; configure business verification and required permissions/advanced access/app review for accounts beyond permitted test roles.
2. Register the exact deployed OAuth redirect URI in the Meta app, define login settings, permitted origins, application privacy policy and data deletion instructions. Do not use Make's OAuth callback as the Instagram callback unless Make itself is the Meta OAuth client.
3. Configure corresponding Instagram connector in Base44, saving credentials in managed server secrets (never client code, entities, logs or Git).
4. Authorize with an actual Instagram professional test account. Return to IFund's existing OAuth continuation, explicitly record per-account AI permission, and verify identity and granted scopes through a harmless API read before marking connected.
5. Implement and validate inbound webhook endpoint: challenge response, signature verification using Meta app secret, deduplication, event ownership matching, retries, logging without message secrets, and replay resistance. Subscribe only to fields that Meta approves for the configured API.
6. Publish only on behalf of an approved account: confirm owner and connection health, optional campaign linkage, scoped AI permission, eligible public media URL, required media container creation, container status, `media_publish` operation, rate-limit handling and idempotency. Store external post IDs and evidence.
7. For comments and DMs: ingest events into the unified inbox and only send responses allowed by Meta permissions, messaging windows and conversation rules. Don't initiate unsolicited DMs, impersonate others, or promise universal automated reply capability.
8. Support user-driven story/feed sharing and allowed embeds as separate features; do not mislabel device-native sharing as Graph API publishing.
9. Provide account disconnect and token revocation/expiry handling, privacy/data deletion workflows, permission degradation, diagnostic test and reconnect guidance.
10. Before enabling live automation: test admin brand account and a separately owned user account; verify revoked consent disables future agent actions, token expiry surfaces reconnect, Meta denial leaves the tile unverified, and failed publish never falsely claims success.

## API publishing sequence
1. `POST /{ig-user-id}/media` — create container.
2. `GET /{container-id}?fields=status_code` — inspect readiness as appropriate.
3. `POST /{ig-user-id}/media_publish` — publish the container.
4. `GET /{ig-user-id}/content_publishing_limit` — inspect quota usage where supported.
Use the API host and version appropriate to the authentication path, and consult the current Meta reference for supported formats, endpoints, and restrictions.

## User-friendly help
1. Open Connections in IFund.
2. Select Instagram.
3. Choose Instagram sign-in; if your business account is linked to a Facebook Page, an alternative connection may be offered when configured.
4. Sign in on Meta's official page and approve the requested access.
5. Return to IFund, choose whether AI may help with that account, and run Check Connection.
6. Only when IFund reports the connection and specific feature as working should you use automated publishing or replies. If it is not working, use reconnect or manual sharing.

## Sources
- https://developers.facebook.com/documentation/instagram-platform
- https://www.postman.com/meta/instagram/folder/1z5vxzu/instagram-api-with-instagram-login
- https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing
