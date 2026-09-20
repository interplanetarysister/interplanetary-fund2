import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const APPROVED_NODE = "22";
const APPROVED_NODE_X = "22.x";

function addFailure(code, target) {
  failures.push(`${code}: ${target}`);
}

function readText(relativePath, { required = false } = {}) {
  const absolutePath = path.join(root, relativePath);
  try {
    return fs.readFileSync(absolutePath, "utf8");
  } catch {
    if (required) addFailure("MISSING_OR_UNREADABLE", relativePath);
    return null;
  }
}

function readJson(relativePath, { required = false } = {}) {
  const text = readText(relativePath, { required });
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    addFailure("MALFORMED_JSON", relativePath);
    return null;
  }
}

function assertExact(label, actual, expected) {
  if (actual !== expected) {
    addFailure("UNAPPROVED_VALUE", `${label}=${JSON.stringify(actual)}`);
  }
}

const packageJson = readJson("package.json", { required: true });
const lockfile = readJson("package-lock.json", { required: true });

assertExact("package.json engines.node", packageJson?.engines?.node, APPROVED_NODE_X);
const lockRoot = lockfile?.packages?.[""];
if (lockRoot?.engines?.node !== undefined) {
  assertExact("package-lock.json packages[''].engines.node", lockRoot.engines.node, APPROVED_NODE_X);
}

for (const selector of [".nvmrc", ".node-version"]) {
  const value = readText(selector, { required: true });
  if (value !== null) assertExact(selector, value.trim(), APPROVED_NODE);
}

function discoverFiles(relativeDir, predicate) {
  const absoluteDir = path.join(root, relativeDir);
  if (!fs.existsSync(absoluteDir)) return [];
  const found = [];
  const pending = [absoluteDir];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      const relative = path.relative(root, absolute);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") || entry.name === ".github" || entry.name === ".devcontainer") pending.push(absolute);
      } else if (predicate(entry.name, relative)) {
        found.push(relative);
      }
    }
  }
  return found;
}

const selectorFiles = new Set([
  ".tool-versions",
  ".node-version",
  ".nvmrc",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  ".devcontainer/devcontainer.json",
  ".devcontainer.json",
  "codemagic.yaml",
  "codemagic.yml",
  "vercel.json",
  ".vercel/project.json",
]);
for (const file of discoverFiles(".", (name, relative) => selectorFiles.has(relative) || /(?:Dockerfile|codemagic|vercel|node-version|nvmrc|tool-versions)/i.test(name))) {
  const content = readText(file);
  if (content === null) continue;
  if (/(?:node(?:js)?|node-version|NODE_VERSION)\s*[:=]\s*["']?(?:18|19|20|21|23|24)(?:\b|["'])/im.test(content)) {
    addFailure("NON_22_SELECTOR", file);
  }
}

const workflowDir = path.join(root, ".github", "workflows");
try {
  const workflowFiles = fs.readdirSync(workflowDir).filter((name) => /\.(?:yml|yaml)$/.test(name));
  for (const file of workflowFiles) {
    const relativePath = `.github/workflows/${file}`;
    const content = readText(relativePath, { required: true });
    if (content === null) continue;

    const setupNodeUses = [...content.matchAll(/^\s*-?\s*uses:\s*actions\/setup-node@[^\n]+$/gm)];
    const nodeVersionLines = [...content.matchAll(/^\s*node-version:\s*([^\n#]+)$/gm)].map((match) => match[1].trim().replace(/["']/g, ""));
    const matrixNodeVersions = [...content.matchAll(/^\s*node-version\s*:\s*\[([^\]]+)\]/gm)].flatMap((match) => match[1].split(",").map((value) => value.trim().replace(/["']/g, "")));
    const allVersions = [...nodeVersionLines, ...matrixNodeVersions];

    if (setupNodeUses.length > 0 && allVersions.length < setupNodeUses.length) {
      addFailure("WORKFLOW_SELECTOR_MISSING", relativePath);
    }
    for (const value of allVersions) {
      if (value !== APPROVED_NODE && value !== APPROVED_NODE_X) {
        addFailure("WORKFLOW_NON_22_SELECTOR", `${relativePath}:${value}`);
      }
    }
    if (/\b(?:node|node-version)\s*[:=]\s*["']?(?:18|19|20|21|23|24)(?:\b|["'])/i.test(content)) {
      addFailure("WORKFLOW_NON_22_SELECTOR", relativePath);
    }
  }
} catch {
  addFailure("MISSING_OR_UNREADABLE", ".github/workflows");
}

if (failures.length > 0) {
  console.error("Runtime baseline reconciliation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Runtime baseline reconciliation passed: all discovered application and CI selectors use the exact Node 22 policy.");
