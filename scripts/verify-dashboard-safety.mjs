import fs from "node:fs";

const source = fs.readFileSync("src/pages/Dashboard.jsx", "utf8");
const required = [
  'const SAFE_DASHBOARD_ERROR = "We couldn\'t load your dashboard. Please try again.";',
  'function normalizeCampaigns(rows, userId)',
  'typeof me.id !== "string"',
  'campaign.created_by_id === userId',
  'typeof c.raised_amount === "number"',
  'typeof c.donor_count === "number"',
  'let active = true',
  'return () => { active = false; }',
  'catch {',
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`Dashboard safety contract missing: ${token}`);
  }
}

if (source.includes('setError(e.message') || source.includes('setError(error.message')) {
  throw new Error("Dashboard must not render raw exception messages");
}

console.log("Dashboard safety contract verified");
