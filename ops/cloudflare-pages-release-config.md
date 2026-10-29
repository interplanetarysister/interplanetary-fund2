# Cloudflare Pages release configuration

- Canonical source: `interplanetarysister/interplanetary-fund2`
- Production branch: `main`
- Build root: repository root (`/`)
- Runtime: Node.js `22.23.2`
- Build command: `npm install --no-audit --no-fund && npm run build`
- Output directory: `dist`
- `npm ci` is not used until the committed npm lockfile is reconciled with package.json; the current lockfile omits `utf-8-validate@5.0.10`.
- Production deployments remain disabled until the independent backend and full parity gates are verified.
