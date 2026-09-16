import fs from "node:fs";

const source = fs.readFileSync("src/pages/OpsCenter.jsx", "utf8");
const checks = [
  ["does not inspect raw thrown message", !source.includes("value.message") && !source.includes("e.message")],
  ["guards overlapping sync", source.includes("syncInFlight.current") && source.includes("if (syncInFlight.current) return")],
  ["guards non-object sync payload", source.includes("typeof res.data === \"object\"")],
  ["ignores stale load completion", source.includes("loadGeneration.current") && source.includes("generation !== loadGeneration.current")],
  ["resets loading in finally", source.includes("if (generation === loadGeneration.current) setLoading(false)")],
  ["resets syncing in finally", source.includes("syncInFlight.current = false") && source.includes("setSyncing(false)")],
  ["keeps stable safe UI copy", source.includes("SAFE_OPS_ERROR") && source.includes("SAFE_SYNC_ERROR")],
];
const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error(`OpsCenter review verifier failed: ${failed.join(", ")}`);
  process.exit(1);
}
console.log(`OpsCenter review verifier passed (${checks.length} checks).`);
