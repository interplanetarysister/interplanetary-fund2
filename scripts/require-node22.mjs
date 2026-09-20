import { execFileSync } from 'node:child_process';

const nodeVersion = process.versions.node;
const nodeMajor = Number(nodeVersion.split('.')[0]);

let npmVersion = 'unknown';
try {
  npmVersion = execFileSync('npm', ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch {
  // npm availability is reported for diagnostics; Node 22 is the hard gate.
}

if (nodeMajor !== 22) {
  console.error(
    `Node 22 runtime preflight FAILED: executing Node ${nodeVersion} at ${process.execPath}. ` +
    'Select a supported Node 22 runtime before install, build, typecheck, lint, or verification.',
  );
  process.exit(1);
}

console.log(
  `Node 22 runtime preflight passed: Node ${nodeVersion}, npm ${npmVersion}, executable ${process.execPath}.`,
);
