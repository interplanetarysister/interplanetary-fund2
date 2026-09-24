# Deferred Base44 Workflows

This document records workflow history and remaining safety constraints. The GitHub Sync and External Fund Sync workflow definitions are present in the authoritative Base44 source; this document must not be used to disable them.

---

## GitHub Two-Way Sync

**Capability:** Automated two-way synchronization between Base44 sandbox and the GitHub repository (`interplanetarysister/interplanetary-fund2`), using the native GitHub synchronization control (GitHub REST API, OAuth connector).

**Function:** `syncGitHub` (`base44/functions/syncGitHub/entry.ts`)

### What is implemented

- **Pull direction:** Reads the current HEAD commit SHA on the default branch from the GitHub API, records it in the Platform Access Registry so health checks can detect drift between Base44 and the repository.
- **Push direction:** Advisory check that confirms remote HEAD; surfaces a reminder that destructive push is deferred.
- **Auth gate:** Checks the `github` entry in the Platform Access Registry (fail-closed) before any operation. Uses the GitHub OAuth connector for all API calls — no shell commands, no hardcoded tokens.
- **Audit log:** Every sync call is audit-logged with direction, result, and actor.
- **Admin notifications:** Failures trigger admin notifications linking to the Integrations page.
- **On-demand UI:** Admins can trigger push, pull, or both from the Integration Registry detail panel for the GitHub entry.

### What is deferred

- **Scheduled workflow:** `base44/workflows/GitHub Sync.jsonc` is active in source and invokes the guarded synchronization function every 15 minutes. It must fail closed when GitHub authorization or conflict safety is unavailable.
- **Destructive file-level push:** Writing files directly to GitHub requires careful merge and conflict resolution. This is deferred until the workflow runs under a controlled, auditable identity with explicit commit attribution.
- **Full file-level pull:** Pulling and applying file changes from GitHub into the Base44 sandbox automatically is deferred for the same reason.

### What "trusted workflow identity" means

Before activating the scheduled workflow or destructive file operations:

1. The Base44 workflow must run under a named service identity (a GitHub app or machine account with appropriate permissions) rather than an expiring personal OAuth token.
2. Conflict detection and resolution must be in place — divergent histories must surface as blocked operations, not silent overwrites.
3. The Platform Access Registry entry for `github` must be `ACTIVE` with a verified, non-expiring credential.
4. The workflow must be reviewed and approved by a repository administrator.

### How to activate

1. Establish a GitHub App or machine account with `contents: write` and `workflows: write` permissions on the repository.
2. Store its credentials in the `GITHUB_APP_TOKEN` secret reference.
3. Update the `github` Platform Access Registry entry with `secret_refs: ['GITHUB_APP_TOKEN']` and set `status: ACTIVE`.
4. Keep `base44/workflows/GitHub Sync.jsonc` enabled with direction `both` on its 15-minute schedule.
5. Run the integration health check to verify the credential is valid.
6. Monitor the first several sync runs via the Ops Center audit log before enabling auto-activation.

---

## External Fund Sync (Deferred Workflow)

**Capability:** Automated synchronization of external crowdfunding platform totals into Base44 on a recurring schedule.

**Function:** `syncExternalFunds` is already invoked manually and via the "External Fund Sync" workflow. `base44/workflows/External Fund Sync.jsonc` is present in the authoritative source. Provider adapters must still fail closed when required authorization or rate-limit safety is unavailable.

### Status

The `syncExternalFunds` function is production-ready and callable on demand. The scheduled workflow trigger may be re-added once the following conditions are met:

1. Rate limit buckets are confirmed for all enabled external platforms.
2. The workflow trigger has been reviewed against the zero-credit continuous work directive.
3. A separate workflow for each platform adapter is preferred over a single all-platforms sweep.

---

*Last updated: see git log for this file.*
