# External-agent dependency drift audit — 2026-09-17

## Scope
Exact current-main commit `33a5ba11412100b99553151bdabfa0c4256f8b56` (`External agent changes`) was compared with its parent `d21962711d28b13df19734a26b14dd13f3ea522d`.

## Observed direct package changes
- Added runtime dependency `fflate`.
- Removed runtime dependency `react-quill`.
- Upgraded `react-router-dom` from `^6.30.5` to `^7.18.4`.
- Added development dependencies `@humanfs/node`, `browserslist`, `js-yaml`, and `postcss-selector-parser`.
- Updated `baseline-browser-mapping` and a broad set of transitive lockfile entries.

## Current classification
- `react-router-dom` major-version change: **requires compatibility audit** before release evidence is trusted.
- `fflate`: **requires source-usage audit**; do not assume it is needed.
- `react-quill` removal: **requires import/caller audit** before confirming safe removal.
- New dev dependencies and transitive lockfile updates: **release-integrity review required**; they may be legitimate toolchain changes, but are not attributable to the TermsAcceptance feature without evidence.

## Evidence limits
This document does not claim that any dependency change is unsafe or should be reverted. It records the exact discovery and prevents stale PR evidence from treating the current package graph as equivalent to the prior baseline.

## Required next actions
1. Search source and verifier manifests for `fflate`, `react-quill`, and React Router APIs.
2. Run Node 22 locked install, lint, typecheck, production build, and all committed verifiers with no skips.
3. If compatibility or dead-dependency findings are confirmed, create a focused correction PR from this exact head; do not mix it with unrelated feature work.
4. Rebaseline package/workflow/verifier-touching PRs only after the current package graph is classified.
