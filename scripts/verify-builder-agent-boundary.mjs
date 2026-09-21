import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const exists = (relativePath) => fs.existsSync(path.join(appRoot, relativePath));
const read = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), "utf8");

assert.equal(exists("base44/agents/builder_agent.jsonc"), false,
  "the Builder Agent must stay undeployed until Base44 provides a server-side admin gate");
assert.equal(exists("src/components/platform/BuilderAgentPanel.jsx"), false,
  "the Platform console must not advertise a client-only protected Builder Agent");

const platform = read("src/pages/Platform.jsx");
const identities = read("src/lib/agentIdentity.js");
const chat = read("src/components/agents/AgentChat.jsx");
const runbook = read("docs/deferred-admin-builder-agent.md");

assert.doesNotMatch(platform, /builder_agent|BuilderAgentPanel|value=["']builder["']/);
assert.doesNotMatch(identities, /builder_agent|Admin Builder/);
assert.doesNotMatch(chat, /requiresAdmin|ADMIN_REQUIRED/,
  "generic chat must not imply that a client-side check enforces agent authorization");
assert.match(runbook, /server-enforced admin role\s+boundary/);
assert.match(runbook, /cannot be bypassed/);
assert.match(runbook, /credentials, tokens, or payment secrets/);

console.log("Builder Agent authorization boundary passed");
