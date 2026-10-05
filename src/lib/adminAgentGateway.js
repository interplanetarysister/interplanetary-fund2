import { runtimeContract } from "@/lib/runtimeContract";
import { appParams } from "@/lib/app-params";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function gatewayHeaders() {
  const token = String(appParams.token || "").trim();
  if (!token) throw new Error("Sign in again before opening the admin development gateway.");
  return {
    "content-type": "application/json",
    "authorization": `Bearer ${token}`,
  };
}

async function postGateway(path, body) {
  if (!runtimeContract.adminAgentApiUrl) {
    throw new Error("Admin development-agent gateway is not configured on this host.");
  }
  const response = await fetch(`${runtimeContract.adminAgentApiUrl}${path}`, {
    method: "POST",
    credentials: "include",
    headers: gatewayHeaders(),
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Admin agent request failed.");
  return payload;
}

export async function createAdminAgentSession({ adminKey, agent = "chief_of_staff" }) {
  return postGateway("/v1/admin/agents/session", { adminKey, agent });
}

export async function sendAdminAgentMessage({ sessionId, content, agent }) {
  const started = await postGateway("/v1/admin/agents/message", { sessionId, content, agent });
  if (started.execution_status !== "processing" || !started.activityId) return started;

  let latest = started;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(1250);
    latest = await postGateway("/v1/admin/agents/status", {
      sessionId,
      activityId: started.activityId,
    });
    if (latest.execution_status !== "processing") return latest;
  }

  return {
    ...latest,
    response: latest.response || "The agent is still working. Its request remains recorded in Agent Activity.",
  };
}
