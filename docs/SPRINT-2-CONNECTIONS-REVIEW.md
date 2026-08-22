# Sprint 2 — Connections Review

This sprint hardens the Universal Connections flow against invalid or unsafe configuration while preserving the platform's honest capability model.

## Implemented

- Require HTTPS for connected external/profile URLs.
- Require a display name/handle before saving.
- Reject negative/non-finite externally reported totals and donor counts.
- Require the user's AI Publishing Authorization before saving any non-manual automation mode.
- Require credentials for the destinations where this repository actually supports direct integration (Bluesky, Mastodon, Ko-fi).
- Keep unsupported platform capabilities explicitly represented as link/manual or approval-dependent rather than pretending they are live.
- Preserve the existing owner-scoped PlatformConnection model and per-destination automation modes.

## Agent 2/3 focus

Audit client-side validation versus backend enforcement, credential handling, owner/RLS boundaries, automation consent, unsupported-platform honesty, and whether any alternate write path can bypass these checks.

This PR remains a draft and must not be merged until Agent 2 review, corrections, Agent 3 audit, and explicit user approval are complete.
