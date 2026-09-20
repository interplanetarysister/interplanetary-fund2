import fs from "node:fs";

const source = fs.readFileSync("src/pages/Social.jsx", "utf8");
const required = [
  "SAFE_SOCIAL_ERROR",
  "validateRows",
  "generationRef",
  "mountedRef",
  "base44.entities.PlatformConnection.filter({})",
  "base44.entities.Campaign.filter({})",
  "setError(SAFE_SOCIAL_ERROR)",
];
const forbidden = [
  ".filter({}).catch(() => [])",
  "catch(() => [])",
  "setError(e.message)",
  "setError(error.message)",
];
for (const token of required) {
  if (!source.includes(token)) throw new Error(`missing required token: ${token}`);
}
for (const token of forbidden) {
  if (source.includes(token)) throw new Error(`forbidden unsafe token: ${token}`);
}
console.log("Social fail-closed loading verifier passed");
