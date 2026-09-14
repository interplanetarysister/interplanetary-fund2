import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const manifestPath = path.join(root, "docs", "EXACT_HEAD_VERIFIER_MANIFEST.md");
const packagePath = path.join(root, "package.json");
const workflowPath = path.join(root, ".github", "workflows", "quality-gates.yml");
const COMMAND_TIMEOUT_MS = 120_000;
const COMMAND_OUTPUT_LIMIT = 256 * 1024;

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

function extractActiveRunCommands(yaml) {
  const commands = [];
  const lines = yaml.split(/\r?\n/);
  let inRunBlock = false;
  let runIndent = null;
  for (const rawLine of lines) {
    const indent = rawLine.match(/^\s*/)?.[0].length ?? 0;
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (inRunBlock && indent <= runIndent && !trimmed.startsWith("-")) {
      inRunBlock = false;
      runIndent = null;
    }
    if (!inRunBlock && /^run:\s*\|\s*$/.test(trimmed)) {
      inRunBlock = true;
      runIndent = indent;
      continue;
    }
    if (!inRunBlock) continue;
    const uncommented = rawLine.replace(/\s+#.*$/, "");
    for (const match of uncommented.matchAll(/\bnpm run ([A-Za-z0-9:_-]+)/g)) {
      commands.push(match[1]);
    }
  }
  return commands;
}

const workflowCommands = extractActiveRunCommands(workflow);
const unknownWorkflowCommands = [...new Set(workflowCommands.filter((command) => typeof pkg.scripts?.[command] !== "string"))];
if (unknownWorkflowCommands.length > 0) {
  throw new Error(`quality-gates.yml invokes commands absent from package.json: ${unknownWorkflowCommands.join(", ")}`);
}

const hasManifestDrivenExecution = workflowCommands.includes("verify:exact-head-manifest");
const missingWorkflowCommands = manifestCommands.filter((command) => !workflowCommands.includes(command));
if (!hasManifestDrivenExecution && missingWorkflowCommands.length > 0) {
  throw new Error(`Workflow omits manifest commands and has no active manifest-driven execution: ${missingWorkflowCommands.join(", ")}`);
}

console.log(`Manifest/package command mapping: PASS (${manifestCommands.length} current-main commands)`);
console.log(`Manifest completeness: PASS (${manifestDrivenScriptNames.length} verifier/test scripts)`);
console.log(`Active workflow command references: ${workflowCommands.length}; unknown references: NONE`);
if (hasManifestDrivenExecution) {
  console.log("Workflow coverage: PASS (active manifest-driven execution is enabled)");
} else if (missingWorkflowCommands.length > 0) {
  console.log(`Workflow coverage gaps: ${missingWorkflowCommands.join(", ")}`);
} else {
  console.log("Workflow coverage: PASS (all manifest commands referenced directly)");
}

if (process.argv.includes("--execute")) {
  for (const command of manifestCommands) {
    console.log(`Executing manifest command: npm run ${command}`);
    const result = spawnSync("npm", ["run", command], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: COMMAND_TIMEOUT_MS,
      killSignal: "SIGTERM",
      maxBuffer: COMMAND_OUTPUT_LIMIT,
    });
    const stdout = typeof result.stdout === "string" ? result.stdout : "";
    const stderr = typeof result.stderr === "string" ? result.stderr : "";
    const boundedOutput = `${stdout}${stderr}`.slice(0, COMMAND_OUTPUT_LIMIT);
    if (boundedOutput) {
      process.stdout.write(boundedOutput);
    }
    if (result.error) {
      if (result.error.code === "ETIMEDOUT") {
        throw new Error(`Manifest command timed out after ${COMMAND_TIMEOUT_MS}ms: npm run ${command}`);
      }
      if (result.error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
        throw new Error(`Manifest command exceeded ${COMMAND_OUTPUT_LIMIT}-byte output limit: npm run ${command}`);
      }
      throw new Error(`Manifest command could not start: npm run ${command}: ${result.error.message}`);
    }
    if (result.signal) {
      throw new Error(`Manifest command terminated by signal ${result.signal}: npm run ${command}`);
    }
    if (result.status !== 0) {
      throw new Error(`Manifest command failed: npm run ${command} (exit ${result.status ?? "unknown"})`);
    }
  }
  console.log(`Manifest-driven execution: PASS (${manifestCommands.length} commands)`);
}
