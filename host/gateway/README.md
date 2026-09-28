# Portable admin gateway deployment

This worker is the server boundary used by every non-Base44 Interplanetary Fund frontend for protected development-agent access.

Configure these runtime values on the chosen free host:

- `IFUND_ALLOWED_ORIGINS`: comma-separated approved Interplanetary Fund frontend origins.
- `IFUND_ADMIN_VERIFY_URL`: canonical Base44 `verifyAdminGateway` function URL.
- `IFUND_AGENT_EXECUTE_URL`: canonical Base44 `executeAdminAgentRequest` function URL.
- `IFUND_AUDIT_URL`: canonical Base44 `auditAdminAgentGateway` function URL.
- `IFUND_ADMIN_AGENT_KEY`: protected admin development key; secret store only.
- `IFUND_SERVICE_TOKEN`: protected service credential if the canonical backend requires it.

The frontend gets only the deployed gateway URL as `VITE_ADMIN_AGENT_API_URL`.

A provider/billing outage is reported as degraded. It does not make source builds fail. Requests that cannot execute remain recorded/pending rather than being reported as completed.
