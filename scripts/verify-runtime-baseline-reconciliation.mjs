import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function readText(relativePath, { required = false } = {}) {
  const absolutePath = path.join(root, relativePath);
  try {
    return fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    if (required) {
      failures.push(`${relativePath} is missing or unreadable: ${error instanceof Error ? error.message : String(error)}`);
    }
    return null;
  }
}

function readJson(relativePath, { required = false } = {}) {
  const text = readText(relativePath, { required });
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    failures.push(`${relativePath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function assertExact(label, actual, expected) {
  if (actual !== expected) {
    failures.push(`${label} must be ${JSON.stringify(expected)}; found ${JSON.stringify(actual)}`);
  }
}

const packageJson = readJson("package.json", { required: true });
const lockfile = readJson("package-lock.json", { required: true });

assertExact("package.json engines.node", packageJson?.engines?.node, "22.x");
assertExact("package-lock.json packages[''].engines.node", lockfile?.packages?.[""]?.engines?.node, "22.x");

for (const selector of [".nvmrc", ".node-version"]) {
  const value = readText(selector, { required: true });
  if (value !== null) assertExact(selector, value.trim(), "22");
}

const selectorFiles = [
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
];
for (const selector of selectorFiles) {
  const content = readText(selector);
  if (content === null) continue;
  if (/node(?:js)?\s*[:=]\s*(?:20|21|23|24)|node-version\s*:\s*["']?(?:20|21|23|24)/im.test(content)) {
    failures.push(`${selector} contains a non-22 Node selector`);
  }
}

const workflowDir = path.join(root, ".github", "workflows");
try {
  const workflowFiles = fs.readdirSync(workflowDir).filter((name) => /\.(?:yml|yaml)$/.test(name));
  for (const file of workflowFiles) {
    const relativePath = `.github/workflows/${file}`;
    const content = readText(relativePath, { required: true });
    if (content === null) continue;
    const setupNodeUses = [...content.matchAll(/uses:\s*actions\/setup-node@[^\n]+/g)];
    const nodeVersions = [...content.matchAll(/node-version:\s*([^\n#]+)/g)].map((match) => match[1].trim().replace(/["']/g, ""));
    if (setupNodeUses.length > 0) {
      if (nodeVersions.length !== setupNodeUses.length) {
        failures.push(`${relativePath} must declare exactly one node-version for every setup-node step`);
      }
      for (const value of nodeVersions) {
        if (value !== "22" && value !== "22.x") {
          failures.push(`${relativePath} setup-node must use Node 22; found ${JSON.stringify(value)}`);
        }
      }
    }
    if (/node-version:\s*[^\n]*(?:20|21|23|24)/i.test(content)) {
      failures.push(`${relativePath} contains a non-22 node-version selector`);
    }
  }
} catch (error) {
  failures.push(`.github/workflows is missing or unreadable: ${error instanceof Error ? error.message : String(error)}`);
}

if (failures.length > 0) {
  console.error("Runtime baseline reconciliation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Runtime baseline reconciliation passed: all discovered application and CI selectors use the exact Node 22 policy.");
