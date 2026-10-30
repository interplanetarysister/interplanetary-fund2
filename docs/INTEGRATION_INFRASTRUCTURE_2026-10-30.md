# IFund integration infrastructure record
Updated: 2026-10-30

## Storage responsibilities

- **GitHub**: source-controlled, non-secret provider registry at config/integrations/provider-registry.json, implementation docs, code, required secret names, capability status, and review history.
- **Cloudflare**: Worker runtime and secrets. The non-secret registry mirror is in Workers KV namespace IFUND_INTEGRATION_REGISTRY, namespace ID 0eb694b397d34504821479400733ca01, key ifund-provider-registry-v1. This namespace has not yet been bound to a Worker or read by runtime code.
- **Supabase**: authoritative private provider registry in project ssibsfmtodgximseeqsv, schema ifund_integrations, table provider_registry. The schema is private, RLS is enabled, and direct grants to anon and authenticated are revoked. The table stores provider metadata only, not credentials or user tokens.

## Verified account resources

- Cloudflare zone interplanetaryfund.com is active in account c95db4f2c901f32776471b85f1eda15d.
- Existing Workers include ifund-oauth and interplanetary-fund2.
- Supabase organization is interplanetary fund.
- The current InterplanetaryFund app project is ssibsfmtodgximseeqsv (ACTIVE_HEALTHY; US West).
- A second project, tzehxfikoslihnclhxuz (Ifund), exists and is older. Do not silently switch or delete it.
- The active production Worker configuration still points at the older Supabase project tzehxfikoslihnclhxuz and contains legacy Base44 origin/function URLs. This is a material cutover mismatch; changing those production bindings requires a separately tested deployment and migration verification.
- The OAuth Worker ifund-oauth is currently disabled (OAUTH_ENABLED=false), has no Worker secret bindings, and its current code is an IFund admin OAuth service rather than a completed social-provider OAuth broker. Do not enable it until its admin verification endpoint and required secrets are configured and its flow is tested.
- The production Worker interplanetary-fund2 has no Worker secret bindings. Its current settings include only plain-text configuration and a publishable Supabase key. No third-party provider client secrets were found in either Worker.

## Supabase registry security

ifund_integrations.provider_registry is a private configuration table. It contains provider IDs, auth methods, integration state, supported capabilities, scopes, required Cloudflare secret binding names, docs links, and status notes. It deliberately excludes all client secrets, user access tokens, refresh tokens, Application Passwords, Ghost Admin API keys, and webhook signing secrets.

## Current integration status

The registry contains 46 provider options across fundraising, social/publishing, productivity and developer tools. Status values describe actual implementation readiness, not marketing availability:
- adapter_present_credentials_missing: source adapter exists; app/provider credentials and live tests are still required.
- needs_provider_app_credentials: IFund must register/configure its own provider developer app and store the resulting credentials in Cloudflare.
- manual_credentials_unverified: owner-supplied dedicated credentials can be entered but safe provider verification and runtime adapters are not complete.
- blocked_pending_security: intentionally disabled until the outbound request security gate is implemented.
- webhook_supported: webhook path exists; production signature/endpoint tests still required.
- link_only: external link only; not an API connection.
- host_connector_required: requires each user to authorize their own supported connected app.

## Required next work

1. Build a provider OAuth broker that uses per-provider redirect URI allowlists, state, PKCE where supported, least-privilege scopes, encrypted server-side token storage, refresh/revocation, and owner-scoped connection records. Do not overload the existing IFund admin OAuth Worker without a reviewed design.
2. Configure Cloudflare secret bindings only after the corresponding provider developer applications are registered. Secret names are listed in the Supabase registry and source-controlled JSON; secret values must never be stored in GitHub or Supabase.
3. Bind the Cloudflare KV registry to the appropriate Worker only when runtime code consumes it; otherwise treat it as a verified backup/cache copy, not a live integration.
4. Reconcile the production Worker's older Supabase project reference and legacy Base44 URLs against the completed cutover plan. Do not change production bindings until data ownership, auth, and endpoint parity are tested.
5. Implement and verify each provider adapter separately: identity, import, publish, media, comments/replies, metrics and webhooks are independent capabilities.
6. Run Node 22 CI, security review, and live owner-authorized provider tests before enabling any connection.

## Important limitation

The platform owner has not supplied or registered the required third-party developer app credentials, and no per-user provider authorization can be granted on behalf of account owners. This work establishes and verifies the three-service registry foundation; it does not claim that third-party accounts are connected or that all API calls are live.
