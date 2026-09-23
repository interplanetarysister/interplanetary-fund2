import assert from "node:assert/strict";
import fs from "node:fs";
const exists = (p) => fs.existsSync(new URL(`../${p}`, import.meta.url));
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const platform = read("src/pages/Platform.jsx");
const chat = read("src/components/agents/AgentChat.jsx");
const bridge = read("base44/functions/recordAgentInteraction/entry.ts");
const identities = read("src/lib/agentIdentity.js");
const runbook = read("docs/deferred-admin-builder-agent.md");

assert.equal(exists("base44/agents/builder_agent.jsonc"), false,
  "Builder Agent configuration must stay absent until Base44 enforces an admin-only conversation boundary");
assert.equal(exists("src/components/platform/BuilderAgentPanel.jsx"), false,
  "Platform must not advertise a Builder Agent that authenticated non-admins can invoke directly");
assert.doesNotMatch(platform, /builder_agent|BuilderAgentPanel|value=["']builder["']/);
assert.doesNotMatch(identities, /builder_agent|Admin Builder/);
assert.doesNotMatch(chat, /requiresAdmin|ADMIN_REQUIRED/,
  "generic AgentChat must not pretend a client-side prop is a server authorization boundary");
assert.match(bridge, /requestedAgent === 'builder_agent' && user\.role !== 'admin'/,
  "the existing logging bridge should retain defense in depth for stale hosted callers");
assert.match(runbook, /server-enforced admin role\s+boundary/);
assert.match(runbook, /cannot be bypassed/);
assert.match(runbook, /credentials, tokens, or payment secrets/);
console.log("Builder Agent authorization boundary passed");
