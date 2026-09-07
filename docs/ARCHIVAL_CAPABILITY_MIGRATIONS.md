# Archival Capability Migrations

## `interplanetaryfund1` → live application

### Vercel Web Analytics

Source: archival commit `a94b70536fd59db33b63adf8754d8cf7befaef60`.

Reason for migration: the archival repository contained a real production improvement — first-party Vercel Web Analytics — that was absent from the current live application.

Implementation in the live application:
- preserve the current live React/Base44 dependency graph and lockfile;
- initialize Vercel Web Analytics through the supported first-party browser bootstrap;
- load `/_vercel/insights/script.js` with `defer` from `index.html`;
- do not copy unrelated archival code, dependencies, authentication logic, or historical application structure.

Retirement rule: future archival differences are migrated only when they are genuine improvements missing from the current live system. Equivalent/stronger live implementations, obsolete code, weaker security, simulated behavior, and historical-only tooling are not copied back into production.
