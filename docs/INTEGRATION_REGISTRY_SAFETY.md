# Integration Registry Safety Contract

The Base44 registry is an administrative view of provider state, not a source of provider truth.

- A new or manually reauthorized entry must remain fail-closed until a provider-backed check succeeds.
- Historical `ACTIVE`/`EXPIRES_SOON` rows and their timestamps came from configuration-only checks. Registry authorization and admin display quarantine them as Unknown before any health scan. No current registry validator proves live provider access, so external registry-gated actions remain unavailable until a server-owned provider-evidence path is implemented and independently verified.
- Secret or token presence is configuration evidence only. It must never create an `ACTIVE` status or advance `last_successful_verification`. When no supported live provider probe exists, the entry remains fail-closed.
- Changing a previously verified account, authentication type, environment, secret reference, integration kind, or dependency invalidates its `ACTIVE`/`EXPIRES_SOON` authorization immediately; only a new provider-backed check can restore authority. Revocation remains revoked.
- Unknown and malformed statuses render as **Unknown**, never as Active.
- UI requests must have bounded waits, synchronous duplicate-action locks, stale-response/unmount protection, and selected-row reconciliation after refresh.
- Incomplete registry rows cannot acquire default production/authentication metadata in the admin view; reject incomplete responses rather than displaying a fabricated operational environment.
- Provider and SDK errors are logged only in bounded diagnostic form. User-visible and persisted failures use fixed safe messages.
- Convex is legacy evidence only and is not an active health requirement for the Base44 runtime.
- Verification must include negative cases for malformed responses, duplicate clicks, stale refreshes, and manual activation attempts.
- Contract checks should assert the authorization predicate and denial behavior, not incidental explanatory text. A check for a removed bootstrap comment failed after the implementation retained its canonical admin-role guard; the corrected check asserts that guard directly. Passing source checks still does not establish hosted Base44 behavior.

## External browser observations

- Browser-read consent grants only the named read capability. It never enables background automation, publishing, payments, transfers, provider verification, or ledger credit.
- A metered browser job requires an authenticated owner, a same-owner campaign, current capability consent, an atomic single-flight/quota reservation, cooldown enforcement, and fresh authorization immediately before launch.
- An allowlisted hostname is not by itself an SSRF control. DNS resolution must be pinned and private, loopback, link-local, metadata, and rebinding destinations must be denied by a proven egress boundary.
- Until Base44 exposes repository-verifiable atomic reservation and DNS/private-egress controls, `runBrowserConnection` fails closed before reading a Browserbase secret or making an outbound request. Its daily quota is effectively zero.
- Browser observations are external-only text evidence. They never create donations, modify provider-verification status, or make external totals withdrawable.
- Scheduled and direct social publishing both require current provider verification on the same connection before an external request. A saved automation grant does not override disconnected, unverified, stale, future-dated, or provider-error state.
- Scheduled feed mirroring must have an explicit, independently verified service invocation identity and a per-owner provider/connector binding. A platform-wide connector dataset must never be copied into multiple owners' records or attributed to those owners. Until both boundaries are available and executable two-owner tests prove zero cross-tenant reads/writes, mirroring fails closed before connection reads, provider fetches, or `SocialPost` writes.

## Shared connection recipes

- `PlatformConnectionRecipe` records are internal operational metadata. Guests receive `401`; normal users receive only a sanitized availability/next-step view; only admins may see internal transports, connector identifiers, worker keys, or capability lists.
- A caller or admin saying a route succeeded is not provider/runtime proof. The resolver refuses caller-supplied success updates. A future server-owned verifier must supply provider evidence before a recipe becomes `proven`.
- Only fresh `proven` recipes return an explicit transport order. Probation, stale, disabled, malformed, and expired recipes return no route and no implicit fallback—especially no browser fallback.
- Evidence stores bounded codes, not raw provider responses, secrets, tokens, OTPs, browser sessions, or user data.

## App-user OAuth boundary

- Internal Base44 connector identifiers are operational metadata and are never returned to ordinary clients. The documented backend connector surface currently supports app-scoped token retrieval, not server-owned per-user OAuth launch URLs. Until Base44 exposes a supported server-owned app-user launch method, new app-user OAuth launches fail closed; do not restore client-side identifier disclosure.
- An app-user access token proves authorization material is present, not that a provider account is reachable or verified. Finalization records `disconnected`/`unverified` until a supported live provider probe succeeds.
- Capability requests are provider-specific and least-privilege. A general connection/share consent never includes transfer or payout authority and never enables automation. Financial observation and money movement require separate provider support, user authorization, execution-time checks, idempotency, and audit evidence.
- OAuth authority decisions live in the shared executable app-user connector policy used by the server functions. Negative contract tests call that production policy directly with token-only, overbroad-scope, and no-consent inputs; source-text matching alone is not sufficient evidence for authorization, verification, or automation behavior.
- `PlatformConnection` trusted-state writes are server/admin owned. Authenticated-user functions may use service-role writes only after authenticating the caller and validating connection/campaign ownership; owners cannot directly manufacture status, verification, capabilities, consent, automation, or credential state through entity CRUD.
- Every owner-facing response produced after a service-role connection read/write must pass through the shared credential redactor. Success and failure responses preserve only non-secret identifiers plus boolean secret-presence metadata; raw tokens, app passwords, and webhook secrets never enter frontend state.
- Owner-mode reads intentionally cannot see protected credential fields. A server function that must preserve or use a secret first authorizes the owner through the user-scoped record, then fetches that same record by ID through service role. Owner lists use an authenticated, owner-ID-filtered service read followed immediately by redaction so secret-presence metadata is accurate without exposing values.

## Direct provider verification and denial auditing

- Direct credential verification, publishing, and mirroring may contact only fixed endpoints listed in repository-owned policy, and redirects fail closed. User-controlled Mastodon hostnames are not fetched because Base44 exposes no verified DNS resolution-and-pinning/private-egress control for those request paths. Mastodon verification, direct publishing, and mirroring stay unavailable until a safe provider-authorized route exists.
- `verifyAgentPlatformAccess` attempts an `AuditLog` service-role write for anonymous, invalid, and owner-forbidden requests after the Base44 client exists. Anonymous denial records contain fixed metadata only; request body values, credentials, and requested OBO identifiers are never copied. Audit persistence remains best-effort because the shared audit helper deliberately cannot make an already-denied access request succeed when the audit store is unavailable.

## Agent safety

- Agent instructions must never ask an agent to bypass CAPTCHAs, rate limits, provider terms, safety controls, or human/provider authentication.
- Do not accept caller-injected admin headers, harvest email OTPs, or place admin tokens in prompts, memory, ordinary entities, logs, or user-visible responses.
- Provider-required consent, CAPTCHA, MFA, email/phone verification, identity checks, and terms acceptance remain human/provider-controlled steps.
