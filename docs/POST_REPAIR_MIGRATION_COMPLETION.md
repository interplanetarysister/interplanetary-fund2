# Post-repair migration and completion ledger

Branch: `base44/post-repair-feature-completion-20261008`

This branch is the single continuation point after the validated repair set reached Base44 `main`.
Historical PRs and stale branches are evidence only. Their code is migrated selectively when it remains correct for the current Base44 architecture.

## Migrated and reconciled

- PR #196 Ops Center hardening: restored request-generation/unmount guards, truthful refresh result handling, malformed-response rejection, safe diagnostics, accessible status, and removal of synthetic agent fallback while preserving current admin authorization and donation-review UI.
- PR #199 Analytics hardening: already present on repaired main; retained current safe-error, malformed-response, overlap/unmount, retry and pull-to-refresh implementation.
- PR #200 Connections hardening: restored mounted/request-generation guards, malformed auth/list/sync rejection, sanitized sync result projection, retry-safe loading, and accessible status while preserving current managed-connections, Wix, lifecycle-resolver and OBO behavior.
- PR #204 Integration truth/security: already merged and validated on repaired main; retained.
- PR #205 capability/migration ledger intent: current Base44 application remains authoritative; historical Convex/Vercel behavior is preserved as knowledge but is not reactivated.
- `feature/globe-navigation-mobile-repair`: migrated the non-conflicting mobile/WebView interaction fixes into the current globe implementation: responsive canvas sizing, one-finger vertical page scrolling, pointer capture, pointer-cancel cleanup, bounded pixel ratio, mobile camera distance, finite-coordinate checks and timer cleanup.
- `feature/managed-connection-agent`: current main already contains the newer managed-connection agent, authorization boundary, route-learning resolver and unified OBO model. The older branch is not merged wholesale.
- `feature/provider-adapter-expansion`: superseded by the current provider capability registry and server-authoritative public campaign snapshot/import/sync implementation.
- `agent1/feature-10-platform-foundation`: the old Convex event bridge is not migrated because active Convex runtime is intentionally absent. Current Base44 `PlatformEvent` / `logPlatformEvent` remains the native path.
- `fix/complete-existing-feature-boundaries`: superseded where current main already has owner-safe inbox/notification functions and later security work; no stale wholesale merge.
- `base44-intake`: retired as stale evidence; never merge into current main.

## Completion rules

1. No GitHub Actions or GitHub-hosted coding agents are required for completion while credits are unavailable.
2. Validation is performed directly in the Base44 branch sandbox.
3. No stale branch is merged wholesale into this branch.
4. Provider capabilities remain fail-closed until live provider evidence exists.
5. External money becomes withdrawable only after independently verified settlement into the IFund holding account.
6. Platform fee remains 3% at withdrawal.
7. No raw reusable admin/platform passwords are stored in Base44 entities.
8. No active Convex runtime is reintroduced.

## External blockers that cannot be truthfully implemented from source alone

Provider approval, provider credentials, live OAuth authorization, provider test accounts, payout eligibility, CAPTCHA/identity checks, and live publication/settlement evidence remain external-state requirements. Code must represent these as waiting/needs-attention rather than fabricate completion.
