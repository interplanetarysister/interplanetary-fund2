# Issue #17 — Commit Traceability and Release Identification Plan

## Purpose

Establish a deterministic, reviewable convention for the user's `#00000N` human-use series across every repository/version that is intended to affect live Interplanetary Fund users, without changing runtime behavior until the convention is reviewed and implementation is approved.

## Source-of-truth rule

The canonical live web application repository is `interplanetarysister/interplanetary-fund2`. The Convex backend repository is `interplanetarysister/interplanetary-fund-backend`. Any other repository must first be classified as canonical, deployment-affecting, packaging-only, mirror/reference, or legacy before receiving a live-platform identifier.

No repository will be treated as live-affecting merely because it contains similar code.

## Required assessment

1. Inventory all repositories that can affect the web, Convex backend, Vercel deployment, or Capacitor mobile packages.
2. Identify the current `#00000N` identifiers already present in code, documentation, build metadata, release notes, and agent instructions.
3. Detect duplicate identifiers, missing identifiers, stale identifiers, and identifiers copied into legacy/reference repositories.
4. Map each identifier to an exact commit/tag/release or other immutable source reference so a report can identify exactly which version was approved.
5. Verify that adding an identifier cannot be mistaken for semantic-version data, a user-facing campaign value, or a security/authorization control.
6. Define how the identifier propagates across the React/Vite app, Convex backend, Vercel deployment, and Capacitor packaging without duplicating business logic.

## Proposed implementation boundary

Prefer a single repository metadata document or generated release manifest as the authoritative mapping, rather than manually editing many runtime files. The manifest should record:

- human-use series identifier (`00000N`);
- repository and role;
- exact commit SHA;
- build/deployment target;
- date of approval;
- dependency/source relationship;
- whether the version is live-affecting;
- superseded identifier, when applicable.

The identifier should be informational metadata only. It must never authorize an action, select an account, identify a donor, or determine payment behavior.

## Cross-platform propagation

- **React/Vite web:** expose the identifier only through build/release metadata where a user-facing version indicator is actually required.
- **Convex backend:** record the corresponding immutable backend commit/release association in the release manifest; do not introduce a runtime dependency on a human-use identifier.
- **Vercel:** associate the deployment with the exact application commit SHA and manifest identifier through deployment/release metadata.
- **Capacitor:** associate each mobile build with the exact application commit and manifest identifier; do not rely on an independently maintained mobile-only number.
- **Legacy/mirror repositories:** retain historical identifiers only where needed for traceability and label them explicitly as legacy/reference; do not imply that they are canonical live versions.

## Acceptance criteria

A final implementation is acceptable only when:

1. every live-affecting repository/version has exactly one current human-use identifier;
2. the identifier resolves to an immutable commit/release reference;
3. canonical and legacy repositories are unambiguously distinguished;
4. duplicate/stale identifiers are documented and resolved without rewriting history;
5. web, backend, Vercel, and Capacitor release records can be reconciled to the same approved source state;
6. no runtime authorization, payment, campaign, or user-data behavior depends on the identifier;
7. CI verifies manifest structure and repository/source consistency;
8. Agent 2+3 reviews the final implementation head and Agent 3 performs final publication review.

## Dependencies and safety gates

This work must not bypass the P0 Convex source/deployment reconciliation or financial/runtime gates. It must not overwrite deployed functionality that is absent from visible GitHub source. It must also preserve the current React + Vite architecture and avoid introducing a second release/versioning system where existing deployment metadata can serve the purpose.

## Status

**Planning-only.** No runtime behavior is changed by this document. The next step is exact-head Agent 2+3 plan review, followed by Agent 1 correction, final implementation draft, exact-head validation, Development/release reconciliation where applicable, and the full `1→2→1→3` workflow.
