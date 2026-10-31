# IFund independent owner proof gate — source-only integration

## Current status — 2026-10-30

- The migration branch contains the owner-proof adapters, audited consent handler, and exact-path Worker dispatcher. The Worker code path is present, but it remains disabled unless the server-only `IFUND_OWNER_LINK_ENABLED=enabled` flag is set.
- The branch's `wrangler.toml` is synchronized to current `main`; it adds no dedicated owner-link custom-domain route and no `IFUND_OWNER_LINK_LIMITER` binding. No DNS or domain-routing change was made. A Cloudflare preview build succeeded on Node 22.23.2 / npm 10.9.8 using `npx wrangler preview`; no production deployment occurred.
- The SQL in `owner-proof-rpcs.sql` is source-only in this continuation. No Supabase migration, owner mapping, or consent receipt was written. Verify the target database's current functions and grants before any future activation; source files and mocked tests do not prove deployed state.
- The SQL defines five RPCs (legacy lookup, versioned lookup, legacy commit, audited historical upgrade, audited new-link commit), an append-only `owner_link_consent_audit` table, and its trigger function. The legacy commit is explicitly revoked from `service_role`; only the audited write paths are intended to be callable.
- `owner_identity_map` and `campaign_shadow` are existing private staging relations referenced by these source-only functions; their DDL is not included in this PR. Do not run the SQL against a fresh or unknown database.

## Contract

`linkVerifiedOwnerSessions` requires two live provider-authenticated sessions for the same owner, an exact source mapping, a confirmed Supabase email, explicit consent, a fresh CSRF challenge, and one atomic compare-and-set. A candidate UID or exact-email match is never authorization. `makeOwnerProofAdapters` pins source verification to Base44's `/api/apps/6a67a778342a8fe05ee79cba/entities/User/me` and destination verification to Supabase's `/auth/v1/user`; it rejects redirects, non-JSON, non-200 and oversized responses, and bounds request duration. The consent route maps the gate's commit callback to the audited RPC only; there is no unaudited fallback.

The audited SQL records a durable consent receipt with a unique nonce digest, source owner, destination Auth UID, consent version/origin, provider-session check times, and transition. The read path requires the exact current Supabase user/session, verified owner mapping, no unresolved candidate, and a matching immutable consent receipt. No financial, campaign, agent, or workflow authority is transferred by this mapping.

The consent audit table references `auth.users(id)` with delete restriction. The repository's account-deletion handler currently deletes the Base44 `User` entity; it does not establish a Supabase `auth.users` deletion path. Before deploying this FK, verify the actual Auth deletion lifecycle and define how immutable consent evidence is retained. Do not assume the Base44 deletion handler reaches Supabase Auth.

## Tests and limitations

The latest Node 22 GitHub quality-gates run includes the staged migration/owner-proof suite and the full production build. The staged suite passed 157/157 before the additional parity, cutover-policy, and manifest tests were added; the latest run after those additions is the authoritative count. These are source/static and mocked integration tests, not proof of a live dual-login, deployed RPC privileges, or live tenant isolation. No service key or owner bearer token was obtained or stored.

Before activation, verify the Base44 `User/me` response with an authorized owner; verify a confirmed Supabase `/auth/v1/user` session; test real service-role RPC and anon/authenticated denials through PostgREST; provision only a rate-limiting mechanism verified to remain within the free allowance; configure server-only secrets; and run live tenant-isolation, replay, rollback, and owner-consent tests. Do not enable independent campaign/agent access or shut down Base44 until all required parity and rollback gates are evidenced.

## Rollback

This PR has not applied a database migration, changed owner rows, or enabled the route. For source rollback, disable the feature flag and revert the Worker dispatcher/route integration.

If a future approved deployment applies the SQL:
1. Disable the owner-link handler and confirm no callers remain.
2. Preserve/export any consent receipts and verify there are no linked owners before considering audit-table removal.
3. Drop the audited commit and historical-upgrade RPCs, then the versioned lookup RPC. Drop the audit trigger before its trigger function, and drop the audit table only after its receipts are safely archived.
4. Restore the exact prior legacy commit function definition and re-grant its service-role permission only if the audited RPCs have been removed and the legacy caller is intentionally restored. Never leave both write paths callable.
5. Do not drop pre-existing owner maps or campaign snapshots as part of this rollback. Verify each relation's provenance and dependencies separately.

Historical content counts in the migration manifest are snapshots, not current production-readiness evidence.
