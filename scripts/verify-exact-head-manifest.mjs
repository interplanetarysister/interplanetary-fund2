import fs from "node:fs";
import path from "node:path";

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

const missingPackageCommands = manifestCommands.filter((command) => typeof pkg.scripts?.[command] !== "string");
if (missingPackageCommands.length > 0) {
  throw new Error(`Manifest commands missing from package.json scripts: ${missingPackageCommands.join(", ")}`);
}

const workflowCommands = [...workflow.matchAll(/npm run ([A-Za-z0-9:_-]+)/g)].map((match) => match[1]);
const unknownWorkflowCommands = [...new Set(workflowCommands.filter((command) => typeof pkg.scripts?.[command] !== "string"))];
if (unknownWorkflowCommands.length > 0) {
  throw new Error(`quality-gates.yml invokes commands absent from package.json: ${unknownWorkflowCommands.join(", ")}`);
}

const missingWorkflowCommands = manifestCommands.filter((command) => !workflowCommands.includes(command));
console.log(`Manifest/package command mapping: PASS (${manifestCommands.length} current-main commands)`);
console.log(`Workflow command references: ${workflowCommands.length} registered calls; unknown references: NONE`);
if (missingWorkflowCommands.length > 0) {
  console.log(`Workflow coverage gaps (reported, not silently omitted): ${missingWorkflowCommands.join(", ")}`);
} else {
  console.log("Workflow coverage gaps: NONE");
}
