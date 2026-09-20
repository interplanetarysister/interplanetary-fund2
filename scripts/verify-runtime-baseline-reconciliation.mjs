import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const APPROVED_NODE = "22";
const APPROVED_NODE_X = "22.x";

function fail(code, target) { failures.push(`${code}: ${target}`); }
function readText(relativePath, required = false) {
  try { return fs.readFileSync(path.join(root, relativePath), "utf8"); }
  catch { if (required) fail("MISSING_OR_UNREADABLE", relativePath); return null; }
}
function readJson(relativePath, required = false) {
  const text = readText(relativePath, required);
  if (text === null) return null;
  try { return JSON.parse(text); }
  catch { fail("MALFORMED_JSON", relativePath); return null; }
}
function exact(label, actual, expected) {
  if (actual !== expected) fail("UNAPPROVED_VALUE", `${label}=${JSON.stringify(actual)}`);
}

const pkg = readJson("package.json", true);
const lock = readJson("package-lock.json", true);
exact("package.json engines.node", pkg?.engines?.node, APPROVED_NODE_X);
const lockRoot = lock?.packages?.[""];
if (lockRoot?.engines?.node !== undefined) exact("package-lock.json packages[''].engines.node", lockRoot.engines.node, APPROVED_NODE_X);

for (const selector of [".nvmrc", ".node-version"]) {
  const value = readText(selector, true);
  if (value !== null) exact(selector, value.trim(), APPROVED_NODE);
}

const workflowDir = path.join(root, ".github", "workflows");
try {
  for (const file of fs.readdirSync(workflowDir).filter((name) => /\.(yml|yaml)$/.test(name))) {
    const relative = `.github/workflows/${file}`;
    const content = readText(relative, true) ?? "";
    const setupNodeCount = [...content.matchAll(/^\s*-?\s*uses:\s*actions\/setup-node@/gm)].length;
    const versions = [...content.matchAll(/^\s*node-version:\s*([^\n#]+)$/gm)].map((match) => match[1].trim().replace(/["']/g, ""));
    if (setupNodeCount > versions.length) fail("WORKFLOW_SELECTOR_MISSING", relative);
    for (const version of versions) {
      if (version !== APPROVED_NODE && version !== APPROVED_NODE_X) fail("WORKFLOW_NON_22_SELECTOR", `${relative}:${version}`);
    }
  }
} catch { fail("MISSING_OR_UNREADABLE", ".github/workflows"); }

if (failures.length > 0) {
  console.error("Runtime baseline reconciliation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("Runtime baseline reconciliation passed: Node 22 policy is explicit in application metadata and workflows.");
