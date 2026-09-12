import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const errors = [];

function read(path) {
  try {
    return readFileSync(join(root, path), 'utf8');
  } catch {
    errors.push(`missing:${path}`);
    return '';
  }
}

const pkg = JSON.parse(read('package.json'));
if (pkg.engines?.node !== '22.x') errors.push('package.json engines.node must be 22.x');
if (read('.node-version').trim() !== '22') errors.push('.node-version must be 22');
if (read('.nvmrc').trim() !== '22') errors.push('.nvmrc must be 22');

const workflowsDir = join(root, '.github', 'workflows');
for (const file of readdirSync(workflowsDir).filter((name) => /\.(yml|yaml)$/.test(name))) {
  const path = join('.github', 'workflows', file);
  const text = read(path);
  const nodeVersions = [...text.matchAll(/node-version:\s*['\"]?([^'\"\s]+)['\"]?/g)].map((m) => m[1]);
  for (const version of nodeVersions) {
    if (version !== '22' && version !== '22.x') errors.push(`${path} pins node-version ${version}`);
  }
}

const lock = read('package-lock.json');
if (lock && !/"node"\s*:\s*"22\.x"/.test(lock)) errors.push('package-lock.json root engine must be 22.x');
if (lock && !/node_modules\/@types\/node[\s\S]{0,500}?"version":\s*"22\./.test(lock)) errors.push('package-lock.json must resolve @types/node 22.x');

if (errors.length) {
  console.error('Node 22 release contract FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Node 22 release contract passed for package metadata, version files, workflows, and lockfile.');
