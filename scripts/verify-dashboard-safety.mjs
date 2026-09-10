import fs from "node:fs";

const source = fs.readFileSync("src/pages/Dashboard.jsx", "utf8");
const required = [
  'const SAFE_DASHBOARD_ERROR = "We couldn\'t load your dashboard. Please try again.";',
  'typeof me.id !== "string"',
  'Array.isArray(mine)',
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
