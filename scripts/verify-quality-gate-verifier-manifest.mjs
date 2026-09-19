import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'config', 'quality-gate-verifier-manifest.json');
const packagePath = path.join(root, 'package.json');
const workflowPath = path.join(root, '.github', 'workflows', 'quality-gates.yml');

function fail(message) {
  console.error(`quality-gate verifier manifest: ${message}`);
  process.exitCode = 1;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`cannot read JSON ${path.relative(root, filePath)}`);
    return null;
  }
}

const manifest = readJson(manifestPath);
const pkg = readJson(packagePath);
const workflow = fs.existsSync(workflowPath) ? fs.readFileSync(workflowPath, 'utf8') : '';

if (!manifest || !pkg) process.exit(1);
if (manifest.version !== 1 || manifest.node !== '22.x' || !Array.isArray(manifest.commands) || manifest.commands.length === 0) {
  fail('manifest must declare version 1, Node 22.x, and at least one command');
}

const seenScripts = new Set();
for (const entry of manifest.commands) {
  if (!entry || typeof entry !== 'object') {
    fail('every command entry must be an object');
    continue;
  }
  const { script, source, workflow: workflowFile, required } = entry;
  if (typeof script !== 'string' || !script || seenScripts.has(script)) fail(`duplicate or invalid script entry: ${String(script)}`);
  seenScripts.add(script);
  if (typeof source !== 'string' || !source || !fs.existsSync(path.join(root, source))) fail(`missing verifier source for ${script}: ${source}`);
  if (workflowFile !== '.github/workflows/quality-gates.yml') fail(`unexpected workflow ownership for ${script}`);
  if (required !== true) fail(`manifest entry must be required: ${script}`);
  if (typeof pkg.scripts?.[script] !== 'string') fail(`package script is missing: ${script}`);
  if (!workflow.includes(`npm run ${script}`)) fail(`workflow does not invoke: npm run ${script}`);
}

if (!workflow.includes('npm run verify:quality-gate-verifier-manifest')) {
  fail('quality workflow must invoke the manifest verifier');
}

if (process.exitCode) process.exit(1);
console.log(`quality-gate verifier manifest: verified ${manifest.commands.length} required commands on Node ${manifest.node}`);
