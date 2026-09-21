import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';

export function verifyReleaseContract(root = process.cwd()) {
  const errors = [];

  const executingMajor = Number(process.versions.node.split('.')[0]);
  if (![20, 22].includes(executingMajor)) {
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
  if (readRequired('.node-version')?.trim() !== '22') errors.push('.node-version must be 22');
  if (readRequired('.nvmrc')?.trim() !== '22') errors.push('.nvmrc must be 22');

  const workflowsDir = join(root, '.github', 'workflows');
  let workflowFiles = [];
  try {
    workflowFiles = readdirSync(workflowsDir).filter((name) => /\.(yml|yaml)$/.test(name));
  } catch {
    errors.push('missing:.github/workflows');
  }

  if (!workflowFiles.length) errors.push('workflow inventory must contain at least one YAML file');

  let setupNodeDeclarations = 0;
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
        if (version !== '22' && version !== '22.x') {
          errors.push(`${path} setup-node pins ${version || '<missing>'}; expected literal 22 or 22.x`);
        }
      }
    }
  }

  if (workflowFiles.length && !setupNodeDeclarations) {
    errors.push('workflow inventory must contain an active actions/setup-node declaration');
  }

  const lock = parseRequiredJson('package-lock.json');
  if (lock) {
    if (lock.packages?.['']?.engines?.node !== '>=20 <23') errors.push('package-lock.json root engine must be >=20 <23');
    const nodeTypesVersion = lock.packages?.['node_modules/@types/node']?.version;
    if (typeof nodeTypesVersion !== 'string' || !nodeTypesVersion.startsWith('22.')) {
      errors.push('package-lock.json must resolve @types/node 22.x');
    }
  }

  return errors;
}

function run() {
  const errors = verifyReleaseContract();
  if (errors.length) {
    console.error('Node 22 release contract FAILED');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log('Node runtime contract passed: Node 20/22 execution compatibility with Node 22 preferred metadata and workflow pins.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run();
