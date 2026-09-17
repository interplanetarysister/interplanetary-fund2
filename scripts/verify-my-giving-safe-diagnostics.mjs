import fs from "node:fs";

const source = fs.readFileSync("src/pages/MyGiving.jsx", "utf8");
const checks = [
  ["stable safe error", source.includes("SAFE_MY_GIVING_ERROR")],
  ["malformed data error", source.includes("SAFE_MY_GIVING_DATA_ERROR")],
  ["raw exception not rendered", !source.includes("e.message")],
  ["array guard", source.includes("Array.isArray(data?.donations)")],
  ["mounted fencing", source.includes("mountedRef")],
  ["generation fencing", source.includes("requestGenerationRef")],
  ["retry resets state", source.includes("setDonations(null); void load()")],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(`MyGiving diagnostics verifier failed: ${failed.map(([name]) => name).join(", ")}`);
  process.exit(1);
}

console.log(`MyGiving diagnostics verifier passed (${checks.length} checks).`);
