import assert from "node:assert/strict";
import fs from "node:fs";
const root = new URL("../", import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), "utf8");
const exists = p => fs.existsSync(new URL(p, root));

const panel=read("src/components/agents/AdminDevelopmentChat.jsx");
const gateway=read("src/lib/adminAgentGateway.js");
const worker=read("host/gateway/worker.js");
const normalChat=read("src/components/agents/AgentChat.jsx");

assert.equal(exists("base44/agents/builder_agent.jsonc"), false, "Builder must not become a directly callable Base44 user agent");
assert.doesNotMatch(normalChat,/builder_agent|Admin Builder/,"normal agent chat must not expose builder routing");
assert.match(panel,/user\?\.role !== "admin"/,"development UI must fail closed for non-admin users");
assert.match(gateway,/\/v1\/admin\/agents\/session/);
assert.match(gateway,/\/v1\/admin\/agents\/message/);
assert.doesNotMatch(panel+gateway+worker,/adminknowsthebuilder/,"admin key must never be committed to client or gateway source");
assert.match(worker,/verifyPlatformAdmin/);
assert.match(worker,/user\?\.role==="admin"/);
assert.match(worker,/IFUND_ADMIN_AGENT_KEY/);
assert.match(worker,/sameSecret/);
assert.match(worker,/expires:Date\.now\(\)\+15\*60\*1000/);
assert.match(worker,/IFUND_ALLOWED_ORIGINS/);
assert.match(worker,/admin_agent_message/);
console.log("Admin development-agent server boundary passed");
