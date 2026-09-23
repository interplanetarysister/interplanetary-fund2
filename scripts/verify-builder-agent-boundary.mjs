import assert from "node:assert/strict";
import fs from "node:fs";
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const platform = read("src/pages/Platform.jsx");
const builder = JSON.parse(read("base44/agents/builder_agent.jsonc"));
const panel = read("src/components/platform/BuilderAgentPanel.jsx");
const chat = read("src/components/agents/AgentChat.jsx");
const bridge = read("base44/functions/recordAgentInteraction/entry.ts");
assert.match(platform, /user\.role !== ["']admin["']/,
  "Platform console must remain admin-only");
assert.match(platform, /BuilderAgentPanel/);
assert.match(platform, /value=["']builder["']/);
assert.equal(builder.allow_anonymous_access, false);
assert.match(builder.instructions, /TRAINING EXPANSION:/);
assert.match(builder.instructions, /operational permissions remain enforced separately/i);
assert.match(panel, /administrator-only Platform console/i);
assert.doesNotMatch(chat, /requiresAdmin|ADMIN_REQUIRED/,
  "generic AgentChat must not pretend a client-side prop is a server authorization boundary");
assert.match(bridge, /requestedAgent === 'builder_agent' && user\.role !== 'admin'/,
  "builder interaction bridge must reject non-admin callers");
console.log("Builder Agent layered authorization and training boundary passed");
