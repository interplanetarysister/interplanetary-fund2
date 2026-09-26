# Integration Registry Safety Contract

The Base44 registry is an administrative view of provider state, not a source of provider truth.

- A new or manually reauthorized entry must remain fail-closed until a provider-backed check succeeds.
- Secret or token presence is configuration evidence only. It must never create an `ACTIVE` status or advance `last_successful_verification`. When no supported live provider probe exists, the entry remains fail-closed.
- Unknown and malformed statuses render as **Unknown**, never as Active.
- UI requests must have bounded waits, synchronous duplicate-action locks, stale-response/unmount protection, and selected-row reconciliation after refresh.
- Provider and SDK errors are logged only in bounded diagnostic form. User-visible and persisted failures use fixed safe messages.
- Convex is legacy evidence only and is not an active health requirement for the Base44 runtime.
- Verification must include negative cases for malformed responses, duplicate clicks, stale refreshes, and manual activation attempts.

## External browser observations

- Browser-read consent grants only the named read capability. It never enables background automation, publishing, payments, transfers, provider verification, or ledger credit.
- A metered browser job requires an authenticated owner, a same-owner campaign, current capability consent, an atomic single-flight/quota reservation, cooldown enforcement, and fresh authorization immediately before launch.
- An allowlisted hostname is not by itself an SSRF control. DNS resolution must be pinned and private, loopback, link-local, metadata, and rebinding destinations must be denied by a proven egress boundary.
- Until Base44 exposes repository-verifiable atomic reservation and DNS/private-egress controls, `runBrowserConnection` fails closed before reading a Browserbase secret or making an outbound request. Its daily quota is effectively zero.
- Browser observations are external-only text evidence. They never create donations, modify provider-verification status, or make external totals withdrawable.

## Shared connection recipes

- `PlatformConnectionRecipe` records are internal operational metadata. Guests receive `401`; normal users receive only a sanitized availability/next-step view; only admins may see internal transports, connector identifiers, worker keys, or capability lists.
- A caller or admin saying a route succeeded is not provider/runtime proof. The resolver refuses caller-supplied success updates. A future server-owned verifier must supply provider evidence before a recipe becomes `proven`.
- Only fresh `proven` recipes return an explicit transport order. Probation, stale, disabled, malformed, and expired recipes return no route and no implicit fallback—especially no browser fallback.
- Evidence stores bounded codes, not raw provider responses, secrets, tokens, OTPs, browser sessions, or user data.

## Agent safety

- Agent instructions must never ask an agent to bypass CAPTCHAs, rate limits, provider terms, safety controls, or human/provider authentication.
- Do not accept caller-injected admin headers, harvest email OTPs, or place admin tokens in prompts, memory, ordinary entities, logs, or user-visible responses.
- Provider-required consent, CAPTCHA, MFA, email/phone verification, identity checks, and terms acceptance remain human/provider-controlled steps.
