import fs from "node:fs";

const source = fs.readFileSync("src/pages/Discover.jsx", "utf8");
const required = [
  ["stable safe error copy", "SAFE_DISCOVER_ERROR"],
  ["campaign schema validator", "isSafeCampaignRow"],
  ["status allowlist", "VALID_STATUSES"],
  ["category allowlist", "VALID_CATEGORIES"],
  ["duplicate id rejection", "seen.has(row.id)"],
  ["mounted fencing", "mountedRef.current"],
  ["request generation fencing", "requestRef.current === requestId"],
  ["raw message removed", "e.message"],
];
for (const [label, token] of required) {
  if (!source.includes(token)) throw new Error(`Discover contract missing: ${label}`);
}
if (/catch\s*\([^)]*\)[\s\S]{0,220}\b(?:e|error|err)\.message/.test(source)) throw new Error("Discover still exposes raw caught exception text");
if (!source.includes("if (!validated) throw new Error(\"invalid-campaign-payload\")")) throw new Error("Discover does not fail closed on invalid campaign payloads");
console.log("Discover schema/loading contract passed");
