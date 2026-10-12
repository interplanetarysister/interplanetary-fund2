# IFund provider authorization: routing repair and Nango evaluation

Status: **UI redirect guard applied. Production OAuth across every provider is not yet verified.**
Owner-facing behavior: Connecting an external account must open that provider's real authorization/permissions flow, then return to IFund to verify the user's actual grant. A public provider website is not an authorization route.

## Current architecture and findings

- `src/pages/Connections.jsx` deep-links to `/connections?connect=<catalog-id>` and opens the IFund dialog before any external navigation.
- `src/components/connections/ConnectDialog.jsx` invokes `getAppUserConnector`, then `base44.connectors.connectAppUser(connector_id)`. The backend tracks connector IDs with `OAUTH_ENV` in `base44/shared/connectionVerification.ts`.
- `finalizeAppUserOAuthConnection` pairs a grant to the authenticated IFund user only after an actual app-user connector token appears. `verifyPlatformConnection` must perform a provider read before declaring the connection working.
- Base44's app-level shared connectors are distinct from members' personal OAuth grants. Never substitute the IFund business/admin connection for an end-user connection.
- Crowdfunding sites marked `setupKind: "link"` support a public campaign URL, not end-user account authorization or publishing. Do not call this a connected publishing account or redirect to a homepage as if it were OAuth.
- Frontend now rejects a bare provider homepage returned as the OAuth authorization URL. Failure is shown in IFund without creating a false connection.
- Existing account records, user permissions, hosting, and provider tokens are unchanged.

## Nango verdict

Nango is a possible **separate user-account authorization adapter**, not a universal pass that grants provider posting access. It manages connect sessions, token handling, refresh and connection callbacks, but still requires an IFund-owned developer app, legitimate provider approval and exact scopes per service. Do not swap all working Base44 connectors to Nango merely to use another vendor.

Adopt incrementally only after a real pilot passes. Nango sign-up: https://app.nango.dev/signup ; guide: https://docs.nango.dev/guides/auth/auth-guide .

**Required pilot steps (not yet configured):**

1. Select one provider with supported, approved OAuth authorization and a read-only verification API. Compare its requirements with the existing Base44 app-user connector and choose Nango only if it fixes a real gap.
2. Create the provider's OAuth developer app under the IFund business account. Set the exact callback supplied by Nango. Use provider-approved permissions for the specific requested capability; do not ask for nonexistent or excessive scopes.
3. Configure a Nango integration and Nango server secret **only in Base44 runtime secrets**. Never put the secret or access tokens in `src`, the public repo, localStorage, URLs, or browser console.
4. An authenticated Base44 backend creates a short-lived Nango Connect Session with `allowed_integrations` restricted to the one selected provider and a tag linking the authorized IFund user.
5. Open Nango Connect UI or the provider's resulting consent route from the IFund Connect button. Authenticate with the provider and ask for its permissions. A provider homepage is never a fallback.
6. Accept success **only after server-side confirmation from Nango's authenticated webhook/API**. Match the user and approved integration to the initiating session, then store only the Nango connection ID + provider ID in an owner-scoped record. Browser callback alone is not proof of authorization. Provider tokens remain server-side.
7. Verify the provider's actual read/write grants independently, without making test posts or fund transfers. Confirm that disabled/revoked grants show Reconnect/Needs attention and no agent action occurs without IFund's separate OBO consent.
8. Test on Android/mobile, desktop, expired sessions, rejection, MFA, callback mismatch, provider outage, multiple users, and repeat authorizations. Roll out provider-by-provider. No hosting, login-system or subscription changes.

## Validation

- `npm run verify:platform-oauth` checks code contracts and the new homepage rejection tests.
- Passing code tests is **not** evidence that a live provider has completed consent. A successful provider OAuth user journey and server-side capability check are the required production gate.
- Keep the Base44 main app checkpoint before any further provider migration.
