import fs from "node:fs";

const source = fs.readFileSync("src/pages/Withdrawals.jsx", "utf8");
const checks = [
  ["stable load error", source.includes("SAFE_WITHDRAWALS_ERROR")],
  ["stable approval error", source.includes("SAFE_APPROVAL_ERROR")],
  ["canonical 7 percent fee", source.includes("PLATFORM_FEE_RATE = 0.07")],
  ["mounted fencing", source.includes("mountedRef") && source.includes("loadGeneration")],
  ["strict campaign/history rows", source.includes("validArray(all)") && source.includes("validArray(w)")],
  ["strict donation envelope", source.includes("readDonationRows")],
  ["per withdrawal single flight", source.includes("approvingRef")],
  ["explicit approval success", source.includes("payload.success !== true")],
  ["no raw message propagation", !/e\\.message|error\\.message|stepErr\\.message/.test(source)],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error("Withdrawals review correction verifier failed:");
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}
console.log(`Withdrawals review correction verifier passed (${checks.length} checks).`);
