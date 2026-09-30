import fs from "node:fs";

const files = ["src/pages/Login.jsx", "src/pages/Register.jsx", "src/pages/ResetPassword.jsx"];
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  if (/setError\([^\n]*(?:err|error|e)\.message/.test(src)) {
    throw new Error(`${file}: raw auth error reaches UI`);
  }
  if (!src.includes("safeAuthErrorMessage")) {
    throw new Error(`${file}: safe auth boundary missing`);
  }
}
const register = fs.readFileSync("src/pages/Register.jsx", "utf8");
const registrationContracts = [
  [/\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\{2,\}\$/, "email validation must use real whitespace escapes"],
  [/Passwords do not match\./, "password mismatch must be actionable"],
  [/Did you mean \\.com\?/, "common .con email typo must be actionable"],
  [/email: cleanEmail/, "registration email must be normalized"],
  [/aria-describedby=\{fieldErrors\.email/, "field errors must be accessible"]
];
for (const [pattern, message] of registrationContracts) {
  if (!pattern.test(register)) throw new Error(`src/pages/Register.jsx: ${message}`);
}
if (register.includes("[^\\\\s@]") || register.includes("/\\\\.con$/")) {
  throw new Error("src/pages/Register.jsx: registration regex contains double-escaped literals");
}

const helper = fs.readFileSync("src/lib/safe-auth-error.js", "utf8");
if (/\.message|String\s*\(/.test(helper)) {
  throw new Error("safe auth helper must not inspect raw exceptions");
}
console.log("Auth-page safe diagnostics contract passed.");
