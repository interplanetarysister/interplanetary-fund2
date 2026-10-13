# Zero-Credit Durable Checkpoint

**Maintained by:** Lyra (Executive AI Program Director) under the Permanent Zero-Message-Credit Continuation Directive.
**Last updated:** 2026-10-13 (UTC) — request-triggered external-sync CAS hardening in progress.

This file is the durable resume point: any executor (agent turn, workflow, or human) should be able to continue from here without reconstructing context. Update it as work progresses.

## Completed work (verified)

1. **Zero-Credit Continuous Work Directive adopted** — PR #185 merged to `main` (`9236e1`): adds `docs/ZERO_CREDIT_CONTINUOUS_WORK.md`; binds AGENTS.md and copilot-instructions.md to it. CI green.
2. **P0 #175 closed** — ruleset `main-protection-quality-gates` (id 22501172) independently re-verified ACTIVE: PR required, strict exact-head CI (`Lint and production build`, `Typecheck`), stale-review dismissal, non-fast-forward + deletion blocked, no bypass actors. Policy documented in `docs/BRANCH_PROTECTION_POLICY.md` (PR #184).
3. **Metered "Autonomous Continuation Cycle" Base44 workflow deactivated** (was consuming agent credits every 30 min; definition preserved for owner-authorized reactivation).
4. **Credit-blocked queue checkpointed in PlatformAccount records** (7 accounts) and the owner's For-you note.

## Current work

P1 payment-truthfulness queue in this repo: **#177** (canonical verified-donation boundary) first, then #179, #178, #180, #176, #181, #182, #183, #173, #172.

## Blocked: requires message credits (owner reserve protected)

- **Platform account creation queue (7):** Spotfund, Honeyfund, Fundable, Piggybackr, Bluesky, Patreon, Fundly — needs agent-driven browser automation (browser tooling is integration-credit free; driving it costs message credits).
- **Treasury:** connect PayPal business account (cuddlemeplatonically@gmail.com) as payment method on Ko-fi and BuyMeACoffee.
- **Ruleset upgrade:** raise `required_approving_review_count` to 1 — blocked on owner providing a second (service/bot) GitHub identity (single-identity constraint).
- **Autonomous Continuation Cycle reactivation** — only on owner authorization of that spend.

## Failed attempts and causes

- **Spotfund signup (2 materially different attempts):** (1) browser session died mid-form (tool iteration limit); (2) final submit click timed out after 300s; no confirmation email received. Account remains uncreated. Next attempt should start the form fresh with a new session.
- **Dependabot:** 7 alerts (1 high, 5 moderate, 1 low) on `main`; no tracking issue yet (no-new-issues rule; owner to decide).

## Available zero-message-credit work (next agent turn or CI)

All GitHub-native work on this repo is message-credit-dependent only via the agent turn itself — the operations (file edits, PRs, CI, API calls) are free:

1. **#177:** inventory every read/write path deriving donation totals, counts, history, analytics, exports, notifications, progress, withdrawal eligibility; reconcile against the `payment_verified === true` boundary; ensure idempotent confirmation.
2. **Dependabot remediation** (owner decides tracking): version bumps with green CI.
3. Remaining P1s in the order listed above.

## Next executable action

Start #177's read/write-path inventory on current `main`. Work through the queue one item per turn, verifying with CI (`npm`-free path: `.github/workflows/quality-gates.yml` runs automatically on every PR to `main`).

## External-sync CAS repair handoff — 2026-10-13

- **Capability inspected:** distributed serialization for explicit, request-triggered external fundraising sync in the existing Base44 architecture.
- **Open-source candidates evaluated:** [DirtyHairy/async-mutex](https://github.com/DirtyHairy/async-mutex) (MIT; maintained and compatible with JavaScript, but process-local only, so it cannot serialize Base44 serverless instances and provides no cross-instance security boundary); [mike-marcacci/node-redlock](https://github.com/mike-marcacci/node-redlock) and [sesamecare/redlock](https://github.com/sesamecare/redlock) (MIT; maintained distributed-lock implementations, but require Redis/ioredis plus new infrastructure and possible cost, while adding an external credential, attack, dependency/supply-chain, availability, and operations surface).
- **Decision and security boundary:** reject those dependencies for this repair and reuse repository-native Base44 conditional `updateMany` compare-and-set. This avoids a new supply-chain/runtime dependency and preserves the current zero-cost/Base44 boundary, but it is safe only with exact observed-state predicates, `updated === 1`, read-after-write verification, and fail-closed handling.
- **Implementation boundary:** request traffic never creates the singleton mutex because `claim_key` is not database-unique. Exactly one release-provisioned `mutex:external-sync:v1` row is required; zero or multiple rows fail closed without persistent writes. Acquisition compares the observed token and expiry so a stale waiter cannot steal a same-token renewed lease. Lease ownership is conditionally renewed and re-read immediately before rate-claim, request-claim, and run writes. Completion conditionally updates only the matching in-progress run/claim and verifies the stored result.
- **Controlled Base44 release provisioning (one-time):** the authoritative live query on 2026-10-13 returned zero coordinator rows, so Sync now remains intentionally unavailable until an authorized release operator performs this procedure. First query `ExternalSyncClaim` with the exact filter `{"claim_key":"mutex:external-sync:v1"}` and retrieve enough rows to detect ambiguity. If the result count is not exactly zero, do not create or retry; one row means verify it, and more than one means keep sync fail-closed and escalate. When and only when the count is zero, create one row through the authorized Base44 data tool with `claim_key="mutex:external-sync:v1"`, `claim_type="mutex"`, `request_key="mutex"`, `request_id="mutex"`, `request_fingerprint="mutex-v1"`, `job_type="external_funds"`, `actor_user_id="system"`, `attempt_number=0`, `claimed_at="1970-01-01T00:00:00.000Z"`, `lock_token=""`, and `lock_expires_at="1970-01-01T00:00:00.000Z"`. If the create response is ambiguous, re-read and never blindly retry.
- **Provisioning proof:** immediately re-run the exact-key query and require count `=== 1`; verify the returned row has `claim_type="mutex"`, empty `lock_token`, the expired epoch `lock_expires_at`, and the expected immutable identity fields. Record the returned Base44 row id and query evidence in this handoff before enabling runtime validation. A count of zero or more than one is a failed release and must leave Sync now unavailable.
- **Test plan:** behavioral contention tests cover concurrent first use without a coordinator, a stale waiter racing a same-token lease renewal, six-request rate contention, lease ownership loss immediately before writes, and stale completion racing a recovered retry; then run typecheck, lint, payment/financial regression tests, and production build.
- **Rollback plan:** revert the shared external-sync guard and its behavioral test together. Do not re-enable request-path mutex creation or remove finalization CAS. If the release-provisioned coordinator is absent, leave sync unavailable rather than weakening serialization.
- **Buffer reminder:** unrelated Buffer source drift is retained. Buffer remains unverified until secret provisioning plus provider-backed connection and safe draft/publish tests succeed; no open-source-audit reminder has been sent.

## Standing constraints

- Never assume configuration/payment/deployment/account state — resolve from authoritative sources.
- Three materially different attempts max, then checkpoint and move on.
- Do not resume Vercel/Convex-specific development; `interplanetary-fund2` is the authoritative Base44-hosting target.
- Integration credits: always authorized. Message credits: reserved floor protected (240/250 used as of 2026-09-08).
