import fs from "node:fs";

const source = fs.readFileSync("src/pages/Institutions.jsx", "utf8");
const checks = [
  ["stable safe error", source.includes("SAFE_INSTITUTIONS_ERROR")],
  ["no raw exception rendering", !source.includes("e.message") && !source.includes("String(e)")],
  ["array response validation", source.includes("Array.isArray(response)")],
  ["row identity validation", source.includes("isInstitutionRow")],
  ["mounted fencing", source.includes("mounted.current")],
  ["request generation fencing", source.includes("requestGeneration.current")],
  ["retry uses bounded loader", source.includes("onRetry={loadInstitutions}")],
];
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(failed.map(([name]) => `FAIL: ${name}`).join("\n"));
  process.exit(1);
}
console.log(`PASS: ${checks.length} Institutions safe-loading checks`);
