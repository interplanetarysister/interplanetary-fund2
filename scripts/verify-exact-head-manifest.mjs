import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const manifestPath = path.join(root, "docs", "EXACT_HEAD_VERIFIER_MANIFEST.md");
const packagePath = path.join(root, "package.json");
const workflowPath = path.join(root, ".github", "workflows", "quality-gates.yml");

const manifest = fs.readFileSync(manifestPath, "utf8");
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const workflow = fs.readFileSync(workflowPath, "utf8");

const currentMainSection = manifest.match(/## Current-main commands([\s\S]*?)## Active PR-local verifier inventory/);
if (!currentMainSection) {
  throw new Error("Missing Current-main commands section in exact-head manifest");
}

const sectionText = currentMainSection[1];
const rows = sectionText.split(/\r?\n/).filter((line) => line.trim().startsWith("-") && line.includes("`"));
const manifestCommands = [];
for (const row of rows) {
  const match = row.match(/^\s*-\s+`([^`]+)`\s+—\s+.+$/);
  if (!match) {
    throw new Error(`Malformed current-main command row: ${row.trim()}`);
  }
  manifestCommands.push(match[1]);
}
if (manifestCommands.length === 0) {
  throw new Error("No current-main commands discovered from exact-head manifest");
}
const duplicateCommands = [...new Set(manifestCommands.filter((command, index) => manifestCommands.indexOf(command) !== index))];
if (duplicateCommands.length > 0) {
  throw new Error(`Duplicate current-main manifest commands: ${duplicateCommands.join(", ")}`);
}

const manifestDrivenScriptNames = Object.keys(pkg.scripts ?? {}).filter((command) => /^(?:verify|test):/.test(command));
const unlistedPackageCommands = manifestDrivenScriptNames.filter((command) => !manifestCommands.includes(command));
if (unlistedPackageCommands.length > 0) {
  throw new Error(`Package verifier/test scripts missing from exact-head manifest: ${unlistedPackageCommands.join(", ")}`);
}

const missingPackageCommands = manifestCommands.filter((command) => typeof pkg.scripts?.[command] !== "string");
if (missingPackageCommands.length > 0) {
  throw new Error(`Manifest commands missing from package.json scripts: ${missingPackageCommands.join(", ")}`);
}

const workflowCommands = [...workflow.matchAll(/npm run ([A-Za-z0-9:_-]+)/g)].map((match) => match[1]);
const unknownWorkflowCommands = [...new Set(workflowCommands.filter((command) => typeof pkg.scripts?.[command] !== "string"))];
if (unknownWorkflowCommands.length > 0) {
  throw new Error(`quality-gates.yml invokes commands absent from package.json: ${unknownWorkflowCommands.join(", ")}`);
}

const hasManifestDrivenExecution = /npm run verify:exact-head-manifest\s+--\s+--execute/.test(workflow);
const missingWorkflowCommands = manifestCommands.filter((command) => !workflowCommands.includes(command));
if (!hasManifestDrivenExecution && missingWorkflowCommands.length > 0) {
  throw new Error(`Workflow omits manifest commands and has no manifest-driven execution: ${missingWorkflowCommands.join(", ")}`);
}

console.log(`Manifest/package command mapping: PASS (${manifestCommands.length} current-main commands)`);
console.log(`Manifest completeness: PASS (${manifestDrivenScriptNames.length} verifier/test scripts)`);
console.log(`Workflow command references: ${workflowCommands.length} registered calls; unknown references: NONE`);
if (hasManifestDrivenExecution) {
  console.log("Workflow coverage: PASS (manifest-driven execution is enabled)");
} else if (missingWorkflowCommands.length > 0) {
  console.log(`Workflow coverage gaps: ${missingWorkflowCommands.join(", ")}`);
} else {
  console.log("Workflow coverage: PASS (all manifest commands referenced directly)");
}

if (process.argv.includes("--execute")) {
  for (const command of manifestCommands) {
    console.log(`Executing manifest command: npm run ${command}`);
    const result = spawnSync("npm", ["run", command], { cwd: root, stdio: "inherit" });
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(`Manifest command failed: npm run ${command} (exit ${result.status ?? "unknown"})`);
    }
  }
  console.log(`Manifest-driven execution: PASS (${manifestCommands.length} commands)`);
}
