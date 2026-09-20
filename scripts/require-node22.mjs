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
  // npm availability is reported for diagnostics; runtime compatibility is the hard gate.
}

// Base44's build workers may run either the maintained Node 20 or Node 22
// runtime. This app does not depend on Node-22-only APIs, so accept both
// supported runtime families while still rejecting unsupported older versions.
if (nodeMajor < 20) {
  console.error(
    `Node runtime preflight FAILED: executing Node ${nodeVersion} at ${process.execPath}. ` +
    'Use a supported Node 20 or Node 22 runtime before install, build, typecheck, lint, or verification.',
  );
  process.exit(1);
}

console.log(
  `Node runtime preflight passed: Node ${nodeVersion}, npm ${npmVersion}, executable ${process.execPath}.`,
);