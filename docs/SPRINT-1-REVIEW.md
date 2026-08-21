# Sprint 1 — Agent 2 Review Brief

Review this branch as a draft. Do not merge to `main`.

## Changes to review

- Publishing endpoints now enforce explicit per-post approval before any external publishing attempt.
- Campaign broadcast processes only posts already marked `approved`.
- Onboarding save now normalizes and persists the complete onboarding state and reliably clears its saving state on errors.
- Communication endpoint validates the requested channels before delivery and rejects unsupported channel names.

## Required review focus

- Authorization and ownership/RLS correctness
- Whether approval can still be bypassed through another code path
- Onboarding persistence compatibility with the User schema
- Communication consent behavior and delivery safety
- Error handling and regression risk
- Build/typecheck/lint/security implications

## Important

Treat this as a draft review branch only. Report corrections in the review rather than merging directly to `main`.
