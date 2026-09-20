import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const verifier = path.resolve("scripts/verify-runtime-baseline-reconciliation.mjs");
const sourceRoot = process.cwd();

function runFixture(mutator) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "ifund-runtime-baseline-"));
  fs.cpSync(sourceRoot, fixture, { recursive: true, filter: (entry) => !entry.includes("node_modules") && !entry.includes(".git") });
  fs.symlinkSync(path.join(sourceRoot, "node_modules"), path.join(fixture, "node_modules"), "dir");
  mutator(fixture);
  return spawnSync(process.execPath, [path.join(fixture, "scripts/verify-runtime-baseline-reconciliation.mjs")], {
    cwd: fixture,
    encoding: "utf8",
  });
}

const conflictingEngines = runFixture((fixture) => {
  const packagePath = path.join(fixture, "package.json");
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  pkg.engines.node = ">=20 <23";
  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
});
assert.notEqual(conflictingEngines.status, 0, "conflicting package engine range must fail");
assert.match(conflictingEngines.stderr, /package\.json engines\.node must be/);

const malformedMetadata = runFixture((fixture) => {
  fs.writeFileSync(path.join(fixture, "package.json"), "{ malformed");
});
assert.notEqual(malformedMetadata.status, 0, "malformed package metadata must fail");
assert.match(malformedMetadata.stderr, /package\.json is not valid JSON/);

const workflowMatrixDrift = runFixture((fixture) => {
  const workflowPath = path.join(fixture, ".github", "workflows", "quality-gates.yml");
  const workflow = fs.readFileSync(workflowPath, "utf8");
  fs.writeFileSync(workflowPath, `${workflow}\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n`);
});
assert.notEqual(workflowMatrixDrift.status, 0, "workflow Node 20 drift must fail");
assert.match(workflowMatrixDrift.stderr, /node-version/);

console.log("Runtime baseline reconciliation negative cases passed.");
