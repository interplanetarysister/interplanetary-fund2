import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const failures = [];

const pkg = JSON.parse(read("package.json"));
const engines = pkg.engines?.node;
if (!engines || !/22/.test(engines)) {
  failures.push(`package.json engines.node must explicitly include Node 22; found ${JSON.stringify(engines)}`);
}

for (const file of [".nvmrc", ".node-version"]) {
  if (fs.existsSync(path.join(root, file))) {
    const value = read(file).trim();
    if (value && !/^22(?:\\.|$)/.test(value)) {
      failures.push(`${file} must remain on Node 22 when present; found ${JSON.stringify(value)}`);
    }
  }
}

const workflowDir = path.join(root, ".github", "workflows");
if (fs.existsSync(workflowDir)) {
  for (const file of fs.readdirSync(workflowDir).filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))) {
    const content = fs.readFileSync(path.join(workflowDir, file), "utf8");
    if (/setup-node@/m.test(content) && !/node-version:\s*["']?22(?:\.x)?["']?/m.test(content)) {
      failures.push(`${file} uses setup-node but does not declare node-version 22`);
    }
  }
}

if (failures.length) {
  console.error("Runtime baseline reconciliation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Runtime baseline reconciliation passed: Node 22 is explicit in application and CI evidence surfaces.");
