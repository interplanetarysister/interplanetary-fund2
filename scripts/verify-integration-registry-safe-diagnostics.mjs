import fs from "node:fs";

const source = fs.readFileSync("base44/shared/integrationRegistry.ts", "utf8");
const required = [
  ["diagnostic helper", source.includes("function diagnosticType(error)")],
  ["emitIntegrationAlert safe logging", source.includes('console.error("emitIntegrationAlert failed", diagnosticType(e));')],
  ["assertPlatformAccess safe logging", source.includes('console.warn("assertPlatformAccess registry read failed", diagnosticType(e));')],
  ["assertOboGrant safe logging", source.includes('console.warn("assertOboGrant read failed", diagnosticType(e));')],
  ["no raw message logging", !source.includes("e.message")],
  ["no object fallback logging", !source.includes(": e);")],
  ["fail-open contract preserved", source.includes('reason: "registry unavailable (fail-open)"')],
  ["fail-closed grant contract preserved", source.includes('reason: "grant registry unavailable"')],
];

const failures = required.filter(([, ok]) => !ok);
if (failures.length) {
  for (const [name] of failures) console.error(`FAIL: ${name}`);
  process.exit(1);
}
console.log(`PASS: integration registry safe diagnostics (${required.length} checks)`);
