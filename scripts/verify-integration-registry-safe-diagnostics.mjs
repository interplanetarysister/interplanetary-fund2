import fs from "node:fs";

const source = fs.readFileSync("base44/shared/integrationRegistry.ts", "utf8");
const required = [
  ["bounded diagnostic classifier", source.includes("function classifyDiagnostic")],
  ["no raw integration alert exception access", !source.includes("e.message") && !source.includes("console.error(\"emitIntegrationAlert failed:\", e)")],
  ["no raw access-gate exception access", !source.includes("console.warn(\"assertPlatformAccess registry read failed:\", e)")],
  ["no raw OBO exception access", !source.includes("console.warn(\"assertOboGrant read failed:\", e)")],
  ["stable diagnostic field", source.includes("{ type: classifyDiagnostic(e) }")],
  ["fail-open access contract preserved", source.includes('registry unavailable (fail-open)')],
  ["fail-closed OBO contract preserved", source.includes('grant registry unavailable')],
];
const failed = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error(`Integration registry diagnostic verifier failed: ${failed.join(", ")}`);
  process.exit(1);
}
console.log(`Integration registry diagnostic verifier passed (${required.length} checks).`);
