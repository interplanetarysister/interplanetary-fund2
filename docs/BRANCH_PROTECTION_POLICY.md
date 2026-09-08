# Branch Protection Policy — `main`

**Status:** Active. Repository ruleset `main-protection-quality-gates` (applied 2026-09-08, tracked in issue #175).
**Scope:** `refs/heads/main` — the canonical production-facing branch for the Base44 application.

## Active rules

| Rule | Setting | Effect |
|---|---|---|
| Pull request required | `required_approving_review_count: 0`, stale reviews dismissed on push | No commit can reach `main` except through a pull request. Every new push to the PR invalidates prior review state. |
| Required status checks (strict) | `Lint and production build`, `Typecheck (informational baseline)` (from `.github/workflows/quality-gates.yml`) | The PR head must pass exact-head CI. With the strict policy, the PR branch must also be up to date with `main` before merging. |
| Block non-fast-forward | — | Force pushes to `main` are rejected. |
| Block deletions | — | `main` cannot be deleted. |

There are **no bypass actors** on the ruleset. The rules apply to all identities, including repository admins.

## Review-count note (single-identity limitation)

All agent work on this repository currently authenticates as the single owner identity (`interplanetarysister`). GitHub does not permit a PR author to approve their own pull request, so a `required_approving_review_count > 0` would deadlock every agent-authored PR. The count is therefore `0` (pull request still required). To raise the bar:

- Create a second (service/bot) GitHub identity for the review agents, then set `required_approving_review_count: 1` in the ruleset and add CODEOWNERS.

Until that exists, the enforced gates are: mandatory pull request + exact-head CI (`lint`, production `build`, safe-error contracts, typecheck baseline) + up-to-date branch. Review-record evidence should be captured in PR comments per the Agent 2+3 / Agent 3 workflow.

## Emergency / admin path

There is no standing bypass. For a verified emergency that cannot flow through a pull request:

1. Temporarily set the ruleset `enforcement` to `evaluate` (or `disabled`) via the GitHub UI (Settings → Rules → Rulesets) or the API:
   `PUT /repos/interplanetarysister/interplanetary-fund2/rulesets/22501172` with `{"enforcement":"disabled"}`.
2. Perform the minimal emergency change.
3. Re-enable `active` immediately.
4. Record the emergency change, its justification, and the window duration in the relevant tracking issue.

## Required evidence for release promotion

Before any publication/production claim based on `main`:

1. CI green on the exact head commit of `main` (`Production Quality Gates`: `Lint and production build`, `Typecheck (informational baseline)`).
2. The change reached `main` through a pull request that passed the strict status-check policy.
3. Review/audit evidence for the change is recorded on the tracking issue or PR per the Agent 2+3 / Agent 3 workflow.
