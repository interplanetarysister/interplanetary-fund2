import fs from "node:fs";

const source = fs.readFileSync("src/pages/Discover.jsx", "utf8");
const checks = [
  ["stable safe error", source.includes("SAFE_DISCOVER_ERROR")],
  ["no raw exception rendering", !/setError\s*\(\s*(?:e|err|error)\??\.message/.test(source)],
  ["fail-closed list payload", source.includes("if (!Array.isArray(payload)) throw")],
  ["fail-closed invalid rows", source.includes("payload.some((campaign)") && source.includes("throw new Error(\"invalid campaign row\")")],
  ["request fencing", source.includes("requestRef") && source.includes("requestId !== requestRef.current")],
  ["mounted fencing", source.includes("mountedRef.current")],
  ["preserve stale data on refresh failure", source.includes("if (error && !campaigns)")],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(`Discover safety verifier failed: ${failed.map(([name]) => name).join(", ")}`);
  process.exit(1);
}
console.log("Discover safety verifier passed");
