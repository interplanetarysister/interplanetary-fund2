# Base44 + GitHub functional recovery checkpoint — 2026-10-02

Canonical commit: `ab7942c32de0e089c1dad5d923ff20a008472b4f`

Checkpoint branch: `checkpoint/base44-github-recovery-2026-10-02`

## Confirmed functional state

- Base44 successfully fetched/synced the GitHub source at this recovery state.
- The Base44 application loaded successfully after the prior fetch/load regression.
- Existing-user login succeeded after restoring native Base44 authentication endpoint selection.
- Navigation across multiple application pages succeeded in user verification.
- GitHub `main` and Base44 therefore share this commit as the functional recovery reference.

## Automated validation observed at checkpoint

Passing:
- Workers Builds: interplanetary-fund2
- CodeQL Analyze (actions)
- CodeQL Analyze (javascript-typescript)
- Node 22 compatibility build
- Typecheck on Base44 baseline
- verify-terms-liability

Outstanding/non-green at time of checkpoint:
- Node 20 Base44 compatibility build: failure
- GitHub Codespaces prebuild: still in progress

This is intentionally recorded as a **functional recovery checkpoint**, not an assertion that every CI job was green. Do not overwrite or delete this checkpoint branch during consolidation. Future repairs should preserve the ability to return to this exact functional state if Base44 source loading, authentication, or navigation regresses.
