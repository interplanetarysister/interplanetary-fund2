import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

function stripYamlComment(line) {
  let singleQuoted = false;
  let doubleQuoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === "'" && !doubleQuoted) singleQuoted = !singleQuoted;
    if (character === '"' && !singleQuoted && line[index - 1] !== '\\') doubleQuoted = !doubleQuoted;
    if (character === '#' && !singleQuoted && !doubleQuoted) return line.slice(0, index);
  }

  return line;
}

function activeYamlLines(text) {
  const active = [];
  let blockIndent = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const indent = rawLine.match(/^\s*/)[0].length;
    const trimmed = rawLine.trim();

    if (blockIndent !== null) {
      if (!trimmed || indent > blockIndent) continue;
      blockIndent = null;
    }

    const line = stripYamlComment(rawLine);
    if (/^\s*[^#][^:]*:\s*[>|][+-]?\s*$/.test(line)) {
      blockIndent = indent;
      active.push(line);
      continue;
    }

    active.push(line);
  }

  return active;
}

export function verifyReleaseContract(root = process.cwd()) {
  const errors = [];

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
  if (pkg && pkg.engines?.node !== '22.x') errors.push('package.json engines.node must be 22.x');
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

  let nodeVersionDeclarations = 0;
  for (const file of workflowFiles) {
    const path = join('.github', 'workflows', file);
    const text = readRequired(path);
    if (text === null || !text.trim()) continue;

    for (const line of activeYamlLines(text)) {
      const match = line.match(/^\s*node-version\s*:\s*(.*?)\s*$/);
      if (!match) continue;
      nodeVersionDeclarations += 1;
      const version = match[1].replace(/^(['"])(.*)\1$/, '$2');
      if (version !== '22' && version !== '22.x') errors.push(`${path} pins node-version ${version || '<empty>'}`);
    }
  }

  if (workflowFiles.length && !nodeVersionDeclarations) {
    errors.push('workflow inventory must contain an active node-version declaration');
  }

  const lock = parseRequiredJson('package-lock.json');
  if (lock) {
    if (lock.packages?.['']?.engines?.node !== '22.x') errors.push('package-lock.json root engine must be 22.x');
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
  console.log('Node 22 release contract passed for package metadata, version files, workflows, and lockfile.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run();
