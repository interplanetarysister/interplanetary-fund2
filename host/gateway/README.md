# Portable admin gateway and MCP proxy deployment

This worker is the server boundary used by non-Base44 Interplanetary Fund frontends for protected development-agent access and for the app's public MCP entrypoint.

## MCP routing

Cloudflare serves the React/Vite application, while Base44 remains the authoritative data plane and MCP implementation. The Worker proxies only the MCP/OAuth paths required by compatible AI clients:

- `/api/mcp` and `/api/mcp/*`
- `/api/apps/*/mcp` and `/api/apps/*/mcp/*`
- OAuth discovery under `/.well-known/oauth-*`

The production hostname remains on the existing Base44 origin for ordinary application traffic. Cloudflare path routes invoke this Worker only for the Worker-owned API surfaces: health, MCP/OAuth discovery, and the protected admin-agent gateway. The public MCP URL therefore remains host-relative:

`https://interplanetaryfund.com/api/mcp`

The Worker also exposes an unauthenticated, non-secret liveness probe at `https://interplanetaryfund.com/api/health`. A healthy response identifies the runtime as `cloudflare-worker`; returning the SPA shell is a deployment failure.

MCP requests are forwarded to `IFUND_BASE44_ORIGIN`, currently `https://interplanetaryfund.base44.app`. The Worker does not duplicate Base44 authorization or tool permission logic; it preserves the canonical OAuth/user-permission boundary.

## Admin development-agent gateway

Configure these runtime values on the chosen free host:

- `IFUND_BASE44_ORIGIN`: canonical Base44 app origin used for the MCP proxy.
- `IFUND_ALLOWED_ORIGINS`: comma-separated approved Interplanetary Fund frontend origins.
- `IFUND_ADMIN_VERIFY_URL`: canonical Base44 `verifyAdminGateway` function URL.
- `IFUND_AGENT_EXECUTE_URL`: canonical Base44 `executeAdminAgentRequest` function URL.
- `IFUND_AUDIT_URL`: canonical Base44 `auditAdminAgentGateway` function URL.
- `IFUND_ADMIN_AGENT_KEY`: protected admin development key; secret store only.
- `IFUND_SERVICE_TOKEN`: optional protected service credential for non-user service calls; it is not the identity used to execute an administrator's development-agent request.

The frontend gets only the deployed gateway URL as `VITE_ADMIN_AGENT_API_URL`. For protected admin requests it also forwards the already-authenticated Base44 bearer credential. The Worker re-verifies that credential with `verifyAdminGateway`, requires canonical super-admin status, and forwards the same user credential to `executeAdminAgentRequest` and the audit boundary. The admin key remains an additional gate and is never exposed as frontend configuration.

Agent execution is asynchronous. `POST /v1/admin/agents/message` starts the approved Base44 agent conversation and returns an activity ID; `POST /v1/admin/agents/status` resolves that activity to the agent conversation and reports `processing`, `waiting_for_user_input`, `completed`, or `failed`. The corresponding `AgentActivity` record remains the durable audit trail.

A provider/billing outage is reported as degraded. It does not make source builds fail, and the gateway must never report an unexecuted request as completed.
