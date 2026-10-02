# Deferred Base44 Workflows

This document records workflow history, retained capabilities, and current safety
constraints. Deferred automation must not be represented as active.

---

## GitHub Two-Way Sync

**Capability to preserve:** Conflict-safe two-way synchronization between the
Base44 sandbox and `interplanetarysister/interplanetary-fund2`, using Base44's
native GitHub synchronization control and a controlled GitHub identity.

**Health function:** `syncGitHub`
(`base44/functions/syncGitHub/entry.ts`)

### What is implemented

- An authenticated administrator can run a manual GitHub connection health
  check from the Integration Registry.
- The check reads the current `main` HEAD through the connected GitHub OAuth
  credential, records the observed SHA, and reports destination reachability.
- The Platform Access Registry is checked fail-closed before any provider call.
- Every completed check is audit-logged with the authenticated administrator as
  actor.
- No shell command, hardcoded token, source application, commit creation, or
  conflict resolution is performed by the deployed function.

### What is deferred and absent

- The scheduled GitHub workflow definition is intentionally absent.
- Base44 currently provides no repository-verified, server-verifiable workflow
  identity that `syncGitHub` can authenticate. A caller-supplied
  `initiator_type` value is only request data and must never grant access.
- Automated file-level push and pull remain deferred until conflict handling,
  attribution, rollback, and a trusted workflow identity are implemented and
  verified.

An unauthenticated invocation always receives `401`; an authenticated
non-admin receives `403`. The manual health check remains available to an
authenticated administrator. A scheduled call without a verifiable identity
must fail closed.

### Safe restoration contract

Restore scheduled synchronization only after all of the following have direct
hosted evidence:

1. Base44 supplies a server-verifiable workflow identity that cannot be forged
   in JSON, headers, or query parameters by an application caller.
2. `syncGitHub` validates that identity before using service-role access.
3. Negative tests prove anonymous, authenticated non-admin, and spoofed
   workflow-label requests are denied.
4. Conflict detection blocks divergent histories instead of overwriting them.
5. Commit attribution, audit records, rollback, and repository permissions are
   reviewed by an administrator.
6. Base44's native source synchronization remains the single source-application
   mechanism unless a separately reviewed replacement is adopted.

---

## External Fund Sync

**Capability:** Synchronize supported external fundraising evidence into
Base44 without treating owner-entered totals as verified or withdrawable funds.

The existing External Fund Sync workflow and `syncExternalFunds` function are
separate from the deferred GitHub workflow. Their provider adapters must remain
fail-closed when authentication, provider evidence, ownership, or rate-limit
safety is unavailable.

---

*Last updated: see git log for this file.*

## Loading and prebuild diagnostics

The GitHub workflow path `dynamic/codespaces/create_codespaces_prebuilds`
identifies a Codespaces environment prebuild. Its `Create Template` / `Upload
Template` steps are not the npm `prebuild` lifecycle and do not establish the
status of Base44's editor synchronization. On October 2, 2026, run 37071398984
completed `Create Template` successfully and moved to `Upload Template`.
Do not diagnose Base44 sync as blocked solely because this Codespaces job runs.

Application startup reads have a 20-second deadline per request. Failed public
settings or identity reads show a safe retry screen; no access is granted on a
failed identity read. Restricted localStorage must not crash parameter parsing.
Route modules remain in the primary application bundle because Base44 preview/runtime navigation must not depend on secondary dynamic chunk delivery. Startup timeout and safe error handling remain covered by `verify:auth-pages-safe-diagnostics` and CI.

The audited main tree contained 599 tracked files, no tracked node_modules/dist
archives, and no symlinks/submodules. The initial local production build passed
in about 11 seconds; commit count alone is not a build-duration estimate.
Base44 editor loading still requires direct editor evidence. Local compilation
and Codespaces state cannot verify that editor has recovered.

A temporary route-splitting change was reverted after Base44 navigation showed route-level load failures when secondary dynamic chunks were requested. Keep route delivery compatible with Base44 preview/runtime unless browser-level verification proves split chunks load correctly there. The CI preview HTTP check verifies served HTML only; its name states that scope instead of claiming browser rendering.
