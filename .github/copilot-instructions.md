# GitHub Work Instructions — Interplanetary Fund

## Required operating directive
All development/build/review agents, Agent 1/2/3, Codex/Copilot-style agents, workflow agents, automations, and authorized contributors must read and follow `docs/ZERO_CREDIT_CONTINUOUS_WORK.md` before substantial work.

While the zero-credit constraint is active, do not initiate metered Base44 builder/agent/workflow/API/deployment operations or other paid operations. Do not bypass quotas or create recursive self-triggering loops. When a paid step is blocked, checkpoint it and continue independent legitimate zero-credit work through repository editing, deterministic checks, static/local verification, documentation, tests, review, and other confirmed non-metered paths. After three materially different failed attempts at one operation, stop retrying it, repair the path or record the blocker, and move to the next useful task.

`interplanetarysister/interplanetary-fund2` is the authoritative user-facing implementation target for Base44 hosting. Do not resume Vercel-specific or Convex-specific feature development. Historical Vercel/Convex code is read-only evidence only; recover useful application behavior without importing obsolete hosting/runtime dependencies.

Never assume runtime, payment, deployment, environment, account, or integration state. Trace claims to authoritative data or mark them unresolved.

## Universal GitHub deletion handoff rule
This rule applies to **all GitHub work in this repository**, regardless of which human, Agent 1/2/3, Codex agent, Copilot agent, workflow agent, automation, reviewer, or other authorized contributor performs the work.

When work identifies a file, workflow, branch artifact, duplicate, obsolete configuration, repository artifact, or other GitHub item that is safe and ready for deletion, first verify that it has no required dependency, active deployment use, or unique required content. If the acting agent/contributor has authority and tooling to delete it safely, perform the deletion. If it cannot perform the deletion itself, leave a comment at the bottom of the relevant issue, pull request, review, or durable work record in this format:

`✨🌟 DELETION READY: <exact item/path> — <brief verified reason it is safe to delete> 🌟✨`

The star marker means verified deletion-ready; it must not be used merely for suspected cleanup. This rule applies to every GitHub task, not only agent workflows or consolidation work.