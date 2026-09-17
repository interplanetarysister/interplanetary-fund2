import fs from "node:fs";

const source = fs.readFileSync("src/pages/Login.jsx", "utf8");
const helper = fs.readFileSync("src/lib/safe-auth-page-error.js", "utf8");

const checks = [
  ["login imports bounded helper", source.includes("safeAuthPageError")],
  ["raw error message is not rendered", !source.includes("err.message") && !source.includes("error.message")],
  ["catch uses stable safe copy", source.includes("setError(safeAuthPageError())")],
  ["loading settles in finally", source.includes("finally") && source.includes("setLoading(false)")],
  ["helper has stable copy", helper.includes("SAFE_AUTH_PAGE_ERROR")],
  ["error region is accessible", source.includes('role=\"alert\"')],
];

for (const [label, passed] of checks) {
  if (!passed) throw new Error(`login diagnostics verifier failed: ${label}`);
}

console.log("login diagnostics verifier passed");
