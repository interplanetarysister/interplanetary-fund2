# IFund owner-consent endpoint — source-only, not activated

2026-10-23 UTC. The `owner-consent-route.mjs` module is an intentionally **unrouted** server-side handler for a future `GET/POST /api/v1/migration/owner-link` endpoint. It imports the existing `owner-link-gate.mjs` and `owner-proof-adapters.mjs` from the same migration branch. Neither GitHub main nor Cloudflare production/preview imports or serves it. No account has been linked as a result of this work.

## Security contract

- Accept requests only over HTTPS, at the exact production apex or `www` origin, with an exact same-origin `Origin` header. No cross-origin CORS or OPTIONS grant. This requires a same-origin user interface on the independent host before activation; do not try to use it from a Base44 cross-site page.
- A GET issues a 5-minute HMAC-signed random CSRF challenge and `Secure; HttpOnly; SameSite=Strict` cookie. POST requires the exact challenge in the cookie and `x-ifund-csrf` header, a valid signature, and `{ "consent": true }` with no other fields. CSRF challenges are not single-use; the database's atomic owner compare-and-set and the durable rate limiter must also be operational.
- POST receives a Base44 session bearer in `x-ifund-base44-token` and a Supabase session bearer in `Authorization`. It passes them to **pinned provider session-verification endpoints** via the existing adapters. No token, email, owner ID, or service-role credential is returned in responses, logged, or placed in URLs. Both provider sessions must belong to the same confirmed owner.
- Supabase service-role and publishable keys, plus a 32+ character CSRF secret, must be injected from **server-only** secret storage. Never put the service-role key in client code or a GitHub file.
- `IFUND_OWNER_LINK_LIMITER` must be a configured **durable** Cloudflare rate-limiting binding with `limit({key})`, applied to both GET challenges and POST commits. Keys are SHA-256 hashes of the Cloudflare-verified client IP, not raw IPs. Missing bindings, IP, or secrets cause HTTP 503. An exhausted limit causes HTTP 429. **No rate-limit resource or paid service was provisioned in this branch.**
- The handler is intentionally fail-closed, with no fallback to email-only matching, JWT decoding, client-supplied owner IDs, or unauthenticated database RPCs. Database owner-link RPCs remain service-role-only and are the sole atomic commit path.

## Verification and activation blockers

Run `node --test host/migration/test-owner-consent-route.mjs` with Node 22+; 19 local tests cover same-origin CSRF, expiration/tampering, explicit consent, request-size bounds, fail-closed rate limiting, server secrets, mocked provider verification and RPCs, and sanitized responses. These are **local mocked integration tests**, not positive live provider authentication or proof of Cloudflare binding behavior.

Before activation: verify actual Base44 `User/me` response with an authorized owner; verify confirmed Supabase `/auth/v1/user` session; test real service-role RPC and anon/authenticated denials through PostgREST; configure and test a non-paid durable rate-limiting binding and server-only secrets; add explicit Worker routing, secure same-origin UI, integration tests, live tenant isolation/replay tests and rollback. Do not deploy without all of these. Do not enable independent campaign/agent access until verified owner links exist. Do not shut down Base44 before full financial, agent, login, and campaign parity.

Rollback for this source-only change: delete the three files introduced in this branch; there is no live traffic, database schema, or permission change to reverse.
