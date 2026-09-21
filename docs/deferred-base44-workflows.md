# Deferred Base44 workflow capabilities

These capabilities are intentionally not scheduled until Base44 can provide a
trusted workflow identity and the native platform contract is verified. Do not
restore the obsolete schedules or simulate success.

## GitHub synchronization

User/platform capability: keep the authoritative Base44 app and
`interplanetarysister/interplanetary-fund2` aligned without overwriting either
side.

Current safe implementation: use Base44's native GitHub synchronization control.
The backend `syncGitHub` function is an authenticated, fail-closed compatibility
boundary and never claims that shell-based pull or push succeeded.

Future implementation contract:

- authenticate an administrator or a dedicated least-privilege workflow identity;
- compare exact source and destination SHAs before applying changes;
- allow fast-forward updates only unless a human resolves divergence;
- report pull and push independently and never label an all-failed run partial;
- keep credentials outside application entities and logs;
- record auditable outcomes without recurring failure notifications.

## External fund synchronization

User/platform capability: discover authoritative provider transactions, preserve
their provider identity and currency, and record them as external observations
without making them withdrawable.

Current safe implementation: owner/admin initiated calls to
`syncExternalFunds`. Unsupported pull adapters report `unavailable`;
owner-reported totals are never counted as synchronized provider data. Ko-fi
continues through its verified webhook path.

Future scheduled implementation contract:

- invoke with a trusted authenticated workflow identity; request-body labels are
  never authentication;
- preserve campaign/connection owner equality;
- require stable provider transaction IDs and explicit ISO currency;
- never combine currencies without an explicit conversion/reconciliation record;
- keep external observations non-withdrawable;
- distinguish success, partial, failed, unavailable, and no-connections outcomes;
- remain idempotent at the canonical financial boundary.

The removed scheduled workflow files may be recreated only after hosted evidence
proves these contracts and the workflow identity.
