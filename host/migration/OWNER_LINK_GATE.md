# IFund independent owner proof gate — staged integration

## Status, 2026-10-23 UTC
- **Source branch only:** `migration/owner-proof-gate-20261023` has the dormant `owner-link-gate.mjs` and new `owner-proof-adapters.mjs`. No browser route or Worker import invokes them. GitHub main and Base44 source are unchanged.
- **Staged Supabase database:** migration `20261023103745_ifund_owner_proof_service_only_atomic_rpc` deployed two service-role-only RPCs from `owner-proof-rpcs.sql`. Both are SECURITY DEFINER with `search_path=pg_catalog`, execute permission **denied** to `PUBLIC`, `anon`, and `authenticated`, and granted only to `service_role`. Both additionally require signed request JWT role `service_role`. No owner links were created.
- **Deployed Cloudflare / live IFund:** no owner-proof route deployed; still Base44-dependent. This migration is **not** a cutover or login migration.
- **Counts at checkpoint:** 8 source owners, 3 untrusted candidate matches, 0 verified links, 24 non-authoritative campaign snapshots, 0 imported agent-history records.

## Contract
`linkVerifiedOwnerSessions` requires two live provider-authenticated sessions for the **same owner**, exact source mapping, confirmed Supabase email, and one atomic compare-and-set. `candidate_auth_uid` is never authorization. `makeOwnerProofAdapters` pins source verification to Base44's `/api/apps/6a67a778342a8fe05ee79cba/entities/User/me` and destination verification to Supabase's `/auth/v1/user`; it rejects redirects, non-JSON, non-200 and oversized responses, and bounds request duration. Database lookup/commit are service-only RPCs. No decoded JWT claims, browser-supplied role, user-provided URL, or candidate hint can authorize a link.

The atomic SQL commit checks `awaiting_destination_login`, NULL destination UID, source email, and a confirmed destination Auth user with matching email. Existing unique destination UID constraint rejects linking a destination to two source owners. No financial, campaign, agent or workflow authority is transferred.

## Tests and limitations
Offline Node 22: 13 adapter unit tests, 3 SQL static contract tests, 4 integration mock tests (cross-tenant, replay, destination collision) passed. Earlier 13 gate tests passed. All new GitHub blobs match local tested blobs. Database introspection confirms RPC privileges and zero verified links. **Mock tests are not proof of a live dual-login**. No service key or owner tokens were obtained or stored.

Before activation, implement an authenticated HTTPS server route that receives both bearer tokens in one deliberate owner session, keeps the Supabase service key in server-only secrets, uses the adapters, provides CSRF/origin/rate limits, never logs tokens, and requires the owner to consent to linking. Verify the Base44 `User/me` response contract with a real authorized user. Test the actual service-role RPC and anon/authenticated rejection through real PostgREST, plus tenant isolation, replay and rollback. Only then permit owner linking. Do not apply `docs/migration/independent-owner-campaigns-rpc.sql` until independently verified destination links exist. No Base44 shutdown until complete end-to-end parity and rollback.

## Rollback and reuse decision
Source: revert the branch commits. Supabase: after verifying no callers depend on the RPCs, drop `public.ifund_migration_owner_commit(text,uuid,text)` and `public.ifund_migration_owner_lookup(text)`; existing owner rows are unchanged. No DNS, payments, or user traffic is altered.

Open-source discovery: `supabase/auth-js` is archived; using provider-authenticated HTTPS endpoints avoids introducing an archived library or another dependency. Existing Base44 and Supabase auth services are reused, not replaced.
