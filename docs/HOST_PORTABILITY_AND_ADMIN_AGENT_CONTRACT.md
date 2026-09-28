# Interplanetary Fund host portability and admin-agent contract

Interplanetary Fund is one product regardless of which approved host serves the frontend.

## Non-negotiable data contract

Until a replacement backend has a verified bidirectional replication layer, every hosted frontend MUST use the same authoritative Base44 application/data plane:

- `VITE_BASE44_APP_ID` = the same Interplanetary Fund app ID on every host.
- `VITE_BASE44_APP_BASE_URL` = the same authoritative Base44 app/backend URL on every host.
- No host may create an independent campaign, donation, user, connection, agent-memory, or admin-action database and call it synchronized.
- A future backend migration must use explicit IDs, idempotent change events, conflict handling, replay/checkpoints, and reconciliation before it may become writable.

This prevents split-brain state while free hosting is introduced.

## Admin development-agent gateway

The browser MUST NOT contain the admin key. The supplied admin key belongs only in the chosen host's protected server-side secret store as `IFUND_ADMIN_AGENT_KEY`.

The frontend receives only `VITE_ADMIN_AGENT_API_URL`, which points to the server-side gateway. The gateway contract is:

- `POST /v1/admin/agents/session` — authenticate the signed-in platform administrator plus the submitted admin key; return an opaque short-lived session ID.
- `POST /v1/admin/agents/message` — accept that opaque session plus a target approved builder/admin development agent and message.
- Re-check platform admin role server-side on every consequential action.
- Compare the key server-side using constant-time comparison. Never return, log, persist to agent memory, or place the raw key in an audit record.
- Rate-limit failed key attempts and expire sessions.
- Record agent identity, requesting admin user ID, requested action, result/status, timestamps, and non-secret evidence reference.
- Development agents may diagnose/build/repair only through configured tools. Payments, withdrawals, ownership, credentials, provider authorization, and other independently protected operations retain their own authorization controls.

## Host configuration

Each approved host receives the same public runtime values and its own protected secrets:

```
VITE_BASE44_APP_ID=<same canonical app id>
VITE_BASE44_APP_BASE_URL=<same canonical backend url>
VITE_ADMIN_AGENT_API_URL=<that host's admin gateway url>
IFUND_ADMIN_AGENT_KEY=<protected server secret; never VITE_ prefixed>
```

The admin gateway may run on a different free host from the static frontend as long as authenticated CORS/origin policy restricts it to approved Interplanetary Fund origins and all deployments share the canonical data plane.
