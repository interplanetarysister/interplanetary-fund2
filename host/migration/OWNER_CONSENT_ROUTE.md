# IFund owner-consent endpoint — source-only, not activated

## Current status — 2026-10-30

The branch contains the server-side `owner-consent-route.mjs` handler and exact-path dispatcher in `host/gateway/worker.js`. The handler is default-disabled and fails closed unless the server-only `IFUND_OWNER_LINK_ENABLED=enabled` flag and all required secrets/bindings are present.

The branch's `wrangler.toml` matches current `main`: it does **not** add a dedicated `/api/v1/migration/owner-link` custom-domain route or an `IFUND_OWNER_LINK_LIMITER` binding. Therefore this PR does not expose the owner-link endpoint on `interplanetaryfund.com`, change DNS, or change domain routing. A Cloudflare Workers preview build succeeded on Node 22.23.2 / npm 10.9.8 with `npx wrangler preview`; it was not a production deployment.

## Security contract

- Accept requests only over HTTPS, at the exact production apex or `www` origin, with an exact same-origin `Origin` header. No cross-origin CORS or OPTIONS grant. A same-origin user interface on the independent host is required before activation.
- A GET issues a 5-minute HMAC-signed random CSRF challenge and `Secure; HttpOnly; SameSite=Strict` cookie. POST requires the exact challenge in the cookie and `x-ifund-csrf` header, a valid signature, and `{ "consent": true }` with no other fields. The database atomic compare-and-set and durable replay protection remain required.
- POST receives a Base44 session bearer in `x-ifund-base44-token` and a Supabase session bearer in `Authorization`. It passes them to pinned provider session-verification endpoints via the existing adapters. No token, email, owner ID, or service-role credential is returned in responses, logged, or placed in URLs. Both provider sessions must belong to the same confirmed owner.
- Supabase service-role and publishable keys, plus a 32+ character CSRF secret, must be injected from server-only secret storage. Never put the service-role key in client code or a GitHub file.
- `IFUND_OWNER_LINK_LIMITER` must be a configured durable rate-limiting binding with `limit({key})`, applied to both GET challenges and POST commits. Keys are SHA-256 hashes of the Cloudflare-verified client IP, not raw IPs. Missing bindings, IP, or secrets cause HTTP 503. An exhausted limit causes HTTP 429. No limiter resource was provisioned in this PR; any future choice must be verified as free before use.
- The handler is fail-closed, with no fallback to email-only matching, JWT decoding, client-supplied owner IDs, or unauthenticated database RPCs. Database owner-link RPCs remain service-role-only and are the sole atomic commit path.

## Verification and activation blockers

The latest Node 22 quality-gates run executes all staged migration tests, including the handler, dispatcher, owner-proof adapters, audited integration path, SQL contracts, and cutover/parity policies. The staged suite passed 157/157 before the additional parity, cutover-policy, and manifest tests were added; the latest run after those additions is the authoritative count. These are offline/static and mocked integration tests, not positive live provider authentication or proof of Cloudflare binding behavior.

Before activation: verify actual Base44 `User/me` and confirmed Supabase `/auth/v1/user` sessions; test real service-role RPC and anon/authenticated denials through PostgREST; configure a free-tier rate-limiting mechanism and server-only secrets; register an explicitly approved route; add the same-origin UI; and run live tenant-isolation, replay, rollback, and owner-consent tests. Keep the feature flag disabled until all gates pass. Do not shut down Base44 before full financial, agent, login, and campaign parity.

## Rollback

No database migration, account link, or production route change occurred in this PR. Source rollback is to remove the Worker dispatcher/import and its tests, then revert the handler and route modules. If a later approved release adds route registration or bindings, revert those exact configuration changes separately after disabling the handler.
