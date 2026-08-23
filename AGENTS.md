# AGENTS.md

## Project Context

This is the **user-facing Interplanetary Fund application repository**. It is the Base44 application layer paired with the authoritative Convex backend and internal-agent runtime in `interplanetarysister/InterplanetaryFund`.

### Canonical repository ownership

- **Application:** `interplanetarysister/interplanetary-fund2` — user-facing Base44 application, frontend, application entities/configuration, application-layer agents and workflows.
- **Authoritative backend / internal agent runtime:** `interplanetarysister/InterplanetaryFund` — Convex backend, persistent agent state/memory, permissions, orchestration, scheduled intelligence, backend protocol, treasury/payments backend, and internal-agent knowledge.
- **Legacy backend snapshot:** `interplanetarysister/interplanetary-fund-backend` — reference only; do not add new production backend features there unless explicitly assigned.

A PR must target the same repository that owns the change. Never merge a PR from one repository into another. Cross-repository behavior must use an explicit API/function/bridge boundary.

## Required first reads

Before substantial work, read:

1. `docs/REPOSITORY_SOURCE_OF_TRUTH.md` — this repository's ownership and boundary.
2. `docs/AGENT_RUNTIME_UNIFICATION.md` — current Base44↔Convex identity and memory bridge.
3. `docs/IF_FEATURE_RECONCILIATION_2026-08-21.md` — current evidence-based feature baseline when feature work is involved.
4. The authoritative `InterplanetaryFund/docs/PROJECT_CONTEXT_ARCHIVE.md` and applicable role-specific material when internal-agent/backend context is needed.
5. The current issue/PR, branch/head, existing handoffs, and recent findings.

Do not rely on the original chat transcript when the decision has been archived in GitHub.

## Agent-role boundary

The project uses **role-specific agents**. Do not assume every agent follows the Convex Builder workflow.

Only agents assigned to build, review, verify, or publish Convex/backend/agent-runtime work use the authoritative workflow in:
`InterplanetaryFund/interplanetary-fund-agent/handoffs/CONVEX_BUILDER_AGENT_WORKFLOW.md`

That workflow is intentionally **not universal**. Application-specific agents must follow their own role instructions.

## Application/backend source of truth

The Convex backend is the source of truth for persistent agent identity, working memory, long-term memory, outcomes, campaigns, protocol, treasury, payments, and scheduled intelligence. Base44 entities may mirror selected backend state for application display, but must not become a competing production source of truth.

## Base44 References

- CLI overview: https://docs.base44.com/developers/references/cli/get-started/overview.md
- Agent skills: https://docs.base44.com/developers/backend/overview/skills.md

If your agent supports Agent Skills, install or update Base44 skills before Base44-specific work:

```bash
npx skills add base44/skills
```

## Key Files

- `src/`: frontend application source.
- `src/api/base44Client.js`: frontend Base44 SDK client.
- `vite.config.js`: Vite config and Base44 Vite plugin setup.
- `base44/`: Base44 entities and application-layer agent definitions/configuration.
- `.env.local`: local-only environment values; never commit secrets.

## Working Notes

- Use `base44 dev` as the default local development command when you need the local Base44 backend. It can run the backend and frontend together.
- When docs or code mention the frontend being started automatically, that usually means the Base44 project config includes `site.serveCommand`, for example `"serveCommand": "npm run dev"` in `base44/config.jsonc`.
- Use `npm run dev` only for frontend-only work against the hosted Base44 backend.
- Prefer the existing Base44 CLI workflow over adding new npm scripts for Base44-specific tasks.
- Reuse the existing SDK client and Vite plugin patterns before adding new Base44 integration paths.
- When an interaction needs authoritative agent memory or backend state, use the established bridge rather than creating a second local memory system.
- Do not copy the internal-agent knowledge base into this repository merely to make it discoverable; reference the canonical backend documents instead.
- Historical/reconstructed feature material is evidence, not automatic production truth.
- Run the relevant checks from `package.json` before finishing code changes.

## Continuity rule

When a new decision changes repository ownership, agent roles, workflow, or the application/backend boundary, update `docs/REPOSITORY_SOURCE_OF_TRUTH.md`, the affected role-specific documentation, and the durable project archive in `InterplanetaryFund` when the decision materially affects future work.
