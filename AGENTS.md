# AGENTS.md

## Project Context

This is the **user-facing Interplanetary Fund application repository**. It is the Base44 application layer and is the production application paired with the canonical Convex backend in `interplanetarysister/InterplanetaryFund`.

### Canonical repository ownership

- **Application:** `interplanetarysister/interplanetary-fund2` (this repository)
- **Authoritative backend / agent runtime:** `interplanetarysister/InterplanetaryFund`
- **Legacy backend snapshot:** `interplanetarysister/interplanetary-fund-backend` (reference only; do not add new production backend features there)

A PR must target the same repository that owns the change. Never merge a PR from one repository into another. Cross-repository behavior must use an explicit API/function/bridge boundary.

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
- `.env.local`: local-only environment values; never commit secrets.

## Working Notes

- Use `base44 dev` as the default local development command when you need the local Base44 backend. It can run the backend and frontend together.
- When docs or code mention the frontend being started automatically, that usually means the Base44 project config includes `site.serveCommand`, for example `"serveCommand": "npm run dev"` in `base44/config.jsonc`.
- Use `npm run dev` only for frontend-only work against the hosted Base44 backend.
- Prefer the existing Base44 CLI workflow over adding new npm scripts for Base44-specific tasks.
- Reuse the existing SDK client and Vite plugin patterns before adding new Base44 integration paths.
- When an interaction needs authoritative agent memory or backend state, use the established bridge rather than creating a second local memory system.
- Run the relevant checks from `package.json` before finishing code changes.
