# Environment-memory source-of-truth boundary

This repository distinguishes three kinds of runtime information:

1. **Normative repository contracts** — `package.json`, `package-lock.json`, `.nvmrc`, `.node-version`, and committed CI/workflow configuration. These define the Node major-version contract used for development and release validation.
2. **Observed environment state** — facts observed in a particular Base44 sandbox session, such as an exact Node/npm patch version or the current working directory. These are useful operational notes but are not durable product or hosted-runtime guarantees.
3. **Unsupported assumptions** — claims about hosted build/runtime behavior, persistent sandbox images, deployment identity, or internal platform services that are not backed by authoritative environment evidence. These must not be inferred from repository notes.

The current contract is Node 22.x. Exact observations such as Node 22.23.2 and npm 10.9.8 must remain non-pinning observations. The `/app` working-directory note is operational guidance only. The sandbox-reset caveat must remain explicit.

Run `npm run verify:environment-memory-boundary` before treating the operational notes as release evidence. This check validates the boundary; it does not prove the identity of any deployed Base44 or Convex environment.
