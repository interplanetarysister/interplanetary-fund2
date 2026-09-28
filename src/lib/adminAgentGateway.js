import { runtimeContract } from "@/lib/runtimeContract";

export async function createAdminAgentSession({ adminKey, agent = "chief_of_staff" }) {
  if (!runtimeContract.adminAgentApiUrl) throw new Error("Admin development-agent gateway is not configured on this host.");
  const response = await fetch(`${runtimeContract.adminAgentApiUrl}/v1/admin/agents/session`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ adminKey, agent }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Admin agent authorization failed.");
  return payload;
}

export async function sendAdminAgentMessage({ sessionId, content, agent }) {
  const response = await fetch(`${runtimeContract.adminAgentApiUrl}/v1/admin/agents/message`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, content, agent }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Admin agent request failed.");
  return payload;
}
