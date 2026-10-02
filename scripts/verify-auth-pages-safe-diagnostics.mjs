import fs from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";

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
const helper = fs.readFileSync("src/lib/safe-auth-error.js", "utf8");
if (/\.message|String\s*\(/.test(helper)) {
  throw new Error("safe auth helper must not inspect raw exceptions");
}
console.log("Auth-page safe diagnostics contract passed.");

// Execute the actual startup deadline function, including a never-settling read.
const auth = fs.readFileSync("src/lib/AuthContext.jsx", "utf8");
const deadlineSource = auth.slice(auth.indexOf("export async function withStartupDeadline"), auth.indexOf("const SAFE_APP_ERROR"));
const deadline = vm.runInNewContext(deadlineSource.replace("export ", "") + "; withStartupDeadline", { setTimeout, clearTimeout });
assert.equal(await deadline(Promise.resolve("ready"), 20), "ready");
await assert.rejects(deadline(Promise.reject(new Error("provider unavailable")), 20), /provider unavailable/);
await assert.rejects(deadline(new Promise(() => {}), 5), /startup timed out/);
const app = fs.readFileSync("src/App.jsx", "utf8");
assert.match(app, /role="alert"/);
assert.match(app, /onClick=\{checkAppState\}/);

// Run startup parameter parsing with storage denied, preserving URL and env inputs.
const params = fs.readFileSync("src/lib/app-params.js", "utf8")
  .replaceAll("import.meta.env", "env")
  .replace("export const appParams", "const appParams") + "; appParams";
const blockedWindow = {
  get localStorage() { throw new Error("Storage denied"); },
  location: { search: "?access_token=test-token", pathname: "/", hash: "", href: "https://example.test/" },
  history: { replaceState() {} }
};
const result = vm.runInNewContext(params, { window: blockedWindow, document: { title: "Test" }, URLSearchParams, env: { VITE_BASE44_APP_ID: "test-app" } });
assert.equal(result.appId, "test-app");
assert.equal(result.token, "test-token");
vm.runInNewContext(params, { URLSearchParams, env: {} });
console.log("Startup timeout, retry, and restricted-storage cases passed.");
