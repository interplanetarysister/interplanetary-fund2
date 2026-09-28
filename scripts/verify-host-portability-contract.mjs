import assert from "node:assert/strict";
import fs from "node:fs";

const read = p => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const runtime = read("src/lib/runtimeContract.js");
const gateway = read("src/lib/adminAgentGateway.js");
const docs = read("docs/HOST_PORTABILITY_AND_ADMIN_AGENT_CONTRACT.md");
const client = read("src/api/base44Client.js");
const panel = read("src/components/agents/AdminDevelopmentChat.jsx");
const worker = read("host/gateway/worker.js");

assert.match(runtime, /VITE_BASE44_APP_ID/);
assert.match(runtime, /VITE_BASE44_APP_BASE_URL/);
assert.match(runtime, /VITE_ADMIN_AGENT_API_URL/);
assert.match(gateway, /\/v1\/admin\/agents\/session/);
assert.match(gateway, /\/v1\/admin\/agents\/message/);
assert.doesNotMatch(runtime + gateway, /adminknowsthebuilder/);
assert.match(docs, /IFUND_ADMIN_AGENT_KEY/);
assert.match(docs, /split-brain/i);
assert.match(docs, /same authoritative Base44 application\/data plane/i);\nassert.match(docs, /MUST NOT fail solely because a paid provider capability is unavailable/i);\nassert.match(docs, /Base44 two-way GitHub sync/i);\nassert.match(docs, /manual-sync-required/i);
assert.match(client, /runtimeContract\.appId/);
assert.match(client, /runtimeContract\.appBaseUrl/);
assert.match(panel, /createAdminAgentSession/);
assert.match(worker, /IFUND_AGENT_EXECUTE_URL/);
assert.match(worker, /degraded.*true/);
assert.doesNotMatch(client + panel + worker, /adminknowsthebuilder/);
console.log("Host portability and admin-agent contract passed");
