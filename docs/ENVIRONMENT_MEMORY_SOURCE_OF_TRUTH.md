# Environment-memory source of truth

This repository treats environment notes as evidence, not as a replacement for executable contracts.

## Normative sources

1. `package.json` engines and lockfile root engine define the Node major-line contract.
2. `.nvmrc`, `.node-version`, and active CI workflow declarations must agree with that contract.
3. Exact-head CI and the committed verifier manifest are the release evidence.

## Operational observations

`AGENTS.md` may record observed sandbox details such as Node/npm patch versions, `/app` as a working directory, and reset behavior. These notes are guidance for reproducible work only. They must not silently pin dependencies, override package metadata, or claim hosted Base44/Convex runtime guarantees.

## Required review boundary

When sandbox state conflicts with repository metadata, stop and record the conflict. Reconcile the authoritative repository and deployment evidence before changing runtime behavior.
