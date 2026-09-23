import assert from "node:assert/strict";
import fs from "node:fs";
const source = fs.readFileSync(new URL("../src/components/agents/AgentChat.jsx", import.meta.url), "utf8");
assert.match(source, /disabled=\{starting \|\| !convRef\.current\}/, "input must stay disabled until conversation is ready");
assert.match(source, /sending \|\| starting \|\| !input\.trim\(\) \|\| !convRef\.current/, "send button must stay disabled until conversation is ready");
assert.match(source, /catch \(recordError\)/, "interaction logging must be isolated from message delivery");
assert.match(source, /setInput\(\(current\) => current \|\| content\)/, "failed message delivery must restore the draft");
assert.match(source, /finally \{\s*setSending\(false\)/, "sending state must always be released");
console.log("Agent chat resilience contract passed");
