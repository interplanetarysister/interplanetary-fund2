import assert from "node:assert/strict";
import fs from "node:fs";
const dir = new URL("../base44/agents/", import.meta.url);
const files = fs.readdirSync(dir).filter(n => n.endsWith(".jsonc"));
assert.equal(files.length, 8, "expected eight configured agents");
for (const file of files) {
  const cfg = JSON.parse(fs.readFileSync(new URL(file, dir), "utf8"));
  const i = cfg.instructions || "";
  assert.match(i, /REASONING AND CAPABILITY PRIORITY:/, `${file}: missing reasoning hierarchy`);
  assert.match(i, /ACTION DISCIPLINE:/, `${file}: missing action/tool distinction`);
  assert.doesNotMatch(i, /Offer to do related tasks for users\. Then do them when accepted\./, `${file}: ambiguous action instruction remains`);
  assert.doesNotMatch(i, /Apply the shared training in docs\//, `${file}: runtime instruction must not depend on inaccessible repo docs`);
  assert.match(i, /Tool and authorization limits define what actions\/data you can actually access, not what concepts you can reason about/, `${file}: capability/tool distinction missing`);
}
const builder=JSON.parse(fs.readFileSync(new URL("builder_agent.jsonc",dir),"utf8"));
assert.match(builder.instructions,/SupportTicket records as part of an explicitly requested diagnosis\/repair workflow/);
assert.match(builder.instructions,/no authorized code-editing tool is available/);
for (const n of ["chief_of_staff.jsonc","communications_agent.jsonc","finance_agent.jsonc","strategy_agent.jsonc"]) {
 const c=JSON.parse(fs.readFileSync(new URL(n,dir),"utf8"));
 assert.ok(c.memory_config?.enabled, `${n}: memory must remain enabled`);
 assert.match(c.memory_config.instructions||"",/Learning expands knowledge and reasoning, never permissions/);
}
console.log("Agent reasoning coherence contract passed for all 8 agents");
