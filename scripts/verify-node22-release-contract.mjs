import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';

const SUPPORTED_MAJORS = new Set([20, 22]);
const BASE44_BASELINE = '20';

export function verifyReleaseContract(root = process.cwd()) {
  const errors = [];

  const executingMajor = Number(process.versions.node.split('.')[0]);
  if (!SUPPORTED_MAJORS.has(executingMajor)) {
    errors.push(`executing Node ${process.versions.node} at ${process.execPath}; Node 20.x or 22.x is required`);
  }

  function readRequired(path) {
    try {
      const value = readFileSync(join(root, path), 'utf8');
      if (!value.trim()) errors.push(`empty:${path}`);
      return value;
    } catch {
      errors.push(`missing:${path}`);
      return null;
    }
  }

  function parseRequiredJson(path) {
    const text = readRequired(path);
    if (text === null || !text.trim()) return null;
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        errors.push(`malformed:${path}: root must be an object`);
        return null;
      }
      return parsed;
    } catch {
      errors.push(`malformed:${path}: invalid JSON`);
      return null;
    }
  }

  const pkg = parseRequiredJson('package.json');
  if (pkg && pkg.engines?.node !== '>=20 <23') errors.push('package.json engines.node must be >=20 <23');
  if (readRequired('.node-version')?.trim() !== BASE44_BASELINE) errors.push('.node-version must use the Node 20 Base44 baseline');
  if (readRequired('.nvmrc')?.trim() !== BASE44_BASELINE) errors.push('.nvmrc must use the Node 20 Base44 baseline');

  const workflowsDir = join(root, '.github', 'workflows');
  let workflowFiles = [];
  try {
    workflowFiles = readdirSync(workflowsDir).filter((name) => /\.(yml|yaml)$/.test(name));
  } catch {
    errors.push('missing:.github/workflows');
  }

  if (!workflowFiles.length) errors.push('workflow inventory must contain at least one YAML file');

  let setupNodeDeclarations = 0;
  let node20Declarations = 0;
  let node22Declarations = 0;
  for (const file of workflowFiles) {
    const path = join('.github', 'workflows', file);
    const text = readRequired(path);
    if (text === null || !text.trim()) continue;

    let workflow;
    try {
      workflow = yaml.load(text);
      if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
        errors.push(`malformed:${path}: root must be an object`);
        continue;
      }
    } catch {
      errors.push(`malformed:${path}: invalid YAML`);
      continue;
    }

    const jobs = workflow.jobs && typeof workflow.jobs === 'object' ? Object.values(workflow.jobs) : [];
    for (const job of jobs) {
      if (!job || typeof job !== 'object' || !Array.isArray(job.steps)) continue;
      for (const step of job.steps) {
        if (!step || typeof step !== 'object' || typeof step.uses !== 'string') continue;
        if (!/^actions\/setup-node@/i.test(step.uses)) continue;

        setupNodeDeclarations += 1;
        const declared = step.with?.['node-version'];
        const version = typeof declared === 'string' || typeof declared === 'number'
          ? String(declared).trim()
          : '';
        if (version === '20' || version === '20.x') node20Declarations += 1;
        if (version === '22' || version === '22.x') node22Declarations += 1;
        if (!['20', '20.x', '22', '22.x'].includes(version)) {
          errors.push(`${path} setup-node pins ${version || '<missing>'}; expected Node 20 or Node 22`);
        }
      }
    }
  }

  if (workflowFiles.length && !setupNodeDeclarations) {
    errors.push('workflow inventory must contain an active actions/setup-node declaration');
  }
  if (setupNodeDeclarations && !node20Declarations) {
    errors.push('workflow inventory must retain at least one Node 20 Base44 compatibility check; do not remove the Base44 lane');
  }
  if (setupNodeDeclarations && !node22Declarations) {
    errors.push('workflow inventory must retain at least one Node 22 compatibility check; do not remove the Node 22 release lane');
  }

  const lock = parseRequiredJson('package-lock.json');
  if (lock) {
    if (lock.packages?.['']?.engines?.node !== '>=20 <23') errors.push('package-lock.json root engine must be >=20 <23');
  }

  return errors;
}

function run() {
  const errors = verifyReleaseContract();
  if (errors.length) {
    console.error('Node 20/22 runtime contract FAILED');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log('Runtime contract passed: Base44 Node 20 compatibility and Node 22 release support are retained.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run();
