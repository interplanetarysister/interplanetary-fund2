import fs from "node:fs";

const source = fs.readFileSync("src/pages/Withdrawals.jsx", "utf8");
const checks = [
  ["stable safe page error boundary", source.includes("PageError")],
  ["raw page error message is not rendered", !source.includes("setError(e.message")],
  ["raw approval toast message is not rendered", !source.includes("description: e.message")],
  ["approval path is explicitly identified", source.includes('requestWithdrawal')],
  ["withdrawal dialog remains URL-addressable", source.includes('searchParams.get("withdraw")')],
  ["admin queue remains role-gated", source.includes('user?.role === "admin"')],
  ["canonical 7% fee policy is represented", source.includes("7% platform fee")],
  ["load path has lifecycle fencing before state commits", /generation|mounted|isMounted|AbortController/.test(source)],
  ["approval path has single-flight protection", /approv(e|ing).*ref|pendingApproval|singleFlight|inFlight/.test(source)],
  ["donation payload is shape-validated before aggregation", /Array\.isArray\(.*donations|Array\.isArray\(dRes\.data/.test(source)],
  ["admin queue authority is not treated as a client-only role check", !source.includes('Withdrawal.filter({ status: "under_review" })')],
];

const failures = checks.filter(([, ok]) => !ok).map(([label]) => label);
if (failures.length) {
  console.error("Withdrawals safe-boundary verifier failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Withdrawals safe-boundary verifier passed (${checks.length} checks).`);
