import fs from "node:fs";

const source = fs.readFileSync("src/pages/Community.jsx", "utf8");
const required = [
  ["stable user-facing error copy", "We couldn't load communities right now. Please try again."],
  ["no raw exception message propagation", "catch {"],
  ["retry uses shared loader", "<PageError message={error} onRetry={loadCommunities} />"],
  ["stale request fencing", "if (requestId !== requestIdRef.current) return;"],
  ["safe response shape", "setCommunities(Array.isArray(all) ? all : []);"],
  ["unmount invalidation", "requestIdRef.current += 1;"],
];
for (const [label, needle] of required) {
  if (!source.includes(needle)) throw new Error(`Community verifier failed: ${label}`);
}
if (/e\.message|error\.message|String\(e\)/.test(source)) {
  throw new Error("Community verifier failed: raw exception text remains in page source");
}
console.log("Community safe-diagnostics contract passed");
