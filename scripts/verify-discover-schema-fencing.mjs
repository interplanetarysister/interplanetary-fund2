import fs from "node:fs";

const source = fs.readFileSync("src/pages/Discover.jsx", "utf8");
const required = [
  "SAFE_DISCOVER_ERROR",
  "MAX_CAMPAIGNS",
  "isSafeCampaignRow",
  "normalizeCampaignRows",
  "duplicate_campaign_id",
  "requestGeneration",
  "mounted",
  "generation !== requestGeneration.current",
  ".catch(() =>",
];

for (const token of required) {
  if (!source.includes(token)) throw new Error(`missing Discover safety contract: ${token}`);
}

if (source.includes("setError(e.message") || source.includes("setError(error.message")) {
  throw new Error("Discover must not expose raw exception text");
}

console.log("Discover schema-fencing verifier passed");
