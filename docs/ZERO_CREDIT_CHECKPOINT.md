# Zero-Credit Durable Checkpoint

**Maintained by:** Lyra (Executive AI Program Director) under the Permanent Zero-Message-Credit Continuation Directive.
**Last updated:** 2026-09-08 (UTC) — post PR #185 merge, #175 closure.

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
- **Treasury:** connect PayPal business account (interplanetarysister@gmail.com) as payment method on Ko-fi and BuyMeACoffee.
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

## Standing constraints

- Never assume configuration/payment/deployment/account state — resolve from authoritative sources.
- Three materially different attempts max, then checkpoint and move on.
- Do not resume Vercel/Convex-specific development; `interplanetary-fund2` is the authoritative Base44-hosting target.
- Integration credits: always authorized. Message credits: reserved floor protected (240/250 used as of 2026-09-08).
