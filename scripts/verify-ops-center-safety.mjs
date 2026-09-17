import fs from "node:fs";

const source = fs.readFileSync("src/pages/OpsCenter.jsx", "utf8");
const checks = [
  ["stable safe load error", source.includes("SAFE_OPS_ERROR")],
  ["stable safe sync error", source.includes("SAFE_SYNC_ERROR")],
  ["no raw exception rendering", !source.includes("e.message")],
  ["array response validation", source.includes("Array.isArray(a)") && source.includes("Array.isArray(c)")],
  ["mounted fencing", source.includes("mountedRef") && source.includes("requestGeneration")],
  ["duplicate sync suppression", source.includes("if (syncing) return")],
  ["accessible loading status", source.includes('role=\"status\"')],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(`OpsCenter safety contract failed: ${failed.map(([name]) => name).join(", ")}`);
  process.exit(1);
}
console.log("OpsCenter safety contract passed.");
