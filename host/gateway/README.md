# Portable admin gateway and MCP proxy deployment

This worker is the server boundary used by non-Base44 Interplanetary Fund frontends for protected development-agent access and for the app's public MCP entrypoint.

## MCP routing

Cloudflare serves the React/Vite application, while Base44 remains the authoritative data plane and MCP implementation. The Worker proxies only the MCP/OAuth paths required by compatible AI clients:

- `/api/mcp` and `/api/mcp/*`
- `/api/apps/*/mcp` and `/api/apps/*/mcp/*`
- OAuth discovery under `/.well-known/oauth-*`

The public MCP URL therefore remains host-relative. On the production domain it is:

`https://interplanetaryfund.com/api/mcp`

MCP requests are forwarded to `IFUND_BASE44_ORIGIN`, currently `https://interplanetaryfund.base44.app`. The Worker does not duplicate Base44 authorization or tool permission logic; it preserves the canonical OAuth/user-permission boundary.

## Admin development-agent gateway

Configure these runtime values on the chosen free host:

- `IFUND_BASE44_ORIGIN`: canonical Base44 app origin used for the MCP proxy.
- `IFUND_ALLOWED_ORIGINS`: comma-separated approved Interplanetary Fund frontend origins.
- `IFUND_ADMIN_VERIFY_URL`: canonical Base44 `verifyAdminGateway` function URL.
- `IFUND_AGENT_EXECUTE_URL`: canonical Base44 `executeAdminAgentRequest` function URL.
- `IFUND_AUDIT_URL`: canonical Base44 `auditAdminAgentGateway` function URL.
- `IFUND_ADMIN_AGENT_KEY`: protected admin development key; secret store only.
- `IFUND_SERVICE_TOKEN`: protected service credential if the canonical backend requires it.

The frontend gets only the deployed gateway URL as `VITE_ADMIN_AGENT_API_URL`.

A provider/billing outage is reported as degraded. It does not make source builds fail. Requests that cannot execute remain recorded/pending rather than being reported as completed.
