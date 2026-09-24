import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");
const exists = (path) => fs.existsSync(new URL(path, root));

const platform = read("src/pages/Platform.jsx");
const chat = read("src/components/agents/AgentChat.jsx");
const identity = read("src/lib/agentIdentity.js");
const bridge = read("base44/functions/recordAgentInteraction/entry.ts");
const runbook = read("docs/deferred-admin-builder-agent.md");

assert.equal(exists("base44/agents/builder_agent.jsonc"), false,
  "builder agent config must remain absent without a server-enforced per-agent admin gate");
assert.equal(exists("src/components/platform/BuilderAgentPanel.jsx"), false,
  "direct Builder chat UI must remain absent while authorization cannot be enforced");

assert.doesNotMatch(platform, /BuilderAgentPanel|value=["']builder["']/,
  "Platform must not expose a client-only Builder tab");
assert.doesNotMatch(chat, /builder_agent|Admin Builder/,
  "generic chat must not hardcode a route to the deferred Builder");
assert.doesNotMatch(identity, /builder_agent|Admin Builder/,
  "runtime aliases must not resolve the deferred Builder");
assert.doesNotMatch(bridge, /builder_agent|Admin Builder/,
  "interaction logging must not imply a callable Builder boundary");

assert.match(runbook, /login-only/i);
assert.match(runbook, /no verified, non-bypassable way to restrict a named agent to the admin role/i);
assert.match(runbook, /authenticated non-admin[\s\S]*direct API/i);
assert.match(runbook, /conversation\s+creation, message, subscription, and tool execution/i);
assert.match(runbook, /metered or unverified proxy/i);
assert.match(runbook, /intentionally absent/i);

console.log("Deferred Builder Agent fail-closed boundary passed");
