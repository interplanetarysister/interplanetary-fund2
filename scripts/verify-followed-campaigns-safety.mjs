import fs from "node:fs";

const source = fs.readFileSync("src/pages/FollowedCampaigns.jsx", "utf8");
const required = [
  'const SAFE_LOAD_ERROR = "We couldn\'t load your followed campaigns. Please try again."',
  "function normalizeFollows(value)",
  "function normalizeCampaigns(value)",
  "generationRef",
  "mountedRef",
  "void load();",
  "setMutationError(SAFE_MUTATION_ERROR)",
  "disabled={busy}",
  "role=\"status\"",
];
for (const fragment of required) {
  if (!source.includes(fragment)) throw new Error(`Missing safety contract: ${fragment}`);
}
if (/setError\(e\.message/.test(source)) throw new Error("Raw exception disclosure remains");
if (/console\.(log|error|warn)\([^\n]*e\.message/.test(source)) throw new Error("Raw exception logging remains");
console.log("FollowedCampaigns safety contract passed");
