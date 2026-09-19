import fs from "node:fs";

const source = fs.readFileSync("src/pages/MyGiving.jsx", "utf8");
const required = [
  ["stable safe error", source.includes("SAFE_MY_GIVING_ERROR")],
  ["no raw exception propagation", !source.includes("e.message") && !source.includes("String(e)")],
  ["response array validation", source.includes("Array.isArray(data.donations)")],
  ["row validation", source.includes("isSafeDonation")],
  ["duplicate rejection", source.includes("new Set(donations.map((d) => d.id))")],
  ["request fencing", source.includes("requestRef.current") && source.includes("mountedRef.current")],
  ["cleanup fencing", source.includes("requestRef.current += 1")],
  ["bounded response", source.includes("MAX_DONATIONS")],
];

const failed = required.filter(([, ok]) => !ok);
if (failed.length) {
  console.error("MyGiving safe-loading verifier failed:");
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}
console.log(`MyGiving safe-loading verifier passed (${required.length} checks).`);
