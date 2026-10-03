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
  // npm availability is reported for diagnostics; Node major is the hard gate.
}

// Base44 may execute on Node 20 while Node 22 is the preferred release/tooling runtime.
// Base44 compatibility remains on Node 20; release/tooling runtime remains Node 22.
const MINIMUM_NODE_MAJOR = 20;
const TESTED_NODE_MAJORS = [20, 22];

if (nodeMajor < MINIMUM_NODE_MAJOR) {
  console.error(
    `Node runtime preflight FAILED: executing Node ${nodeVersion} at ${process.execPath}. ` +
    `Node ${MINIMUM_NODE_MAJOR} or newer is required.`,
  );
  process.exit(1);
}

if (!TESTED_NODE_MAJORS.includes(nodeMajor)) {
  console.warn(
    `Node runtime preflight: Node ${nodeVersion} is newer than the tested Base44 lanes ` +
    `(${TESTED_NODE_MAJORS.join(', ')}). Continuing because IFund supports Node ${MINIMUM_NODE_MAJOR}+ ` +
    'unless a concrete incompatibility is detected.',
  );
}

console.log(
  `Node runtime preflight passed: Node ${nodeVersion}, npm ${npmVersion}, executable ${process.execPath}.`,
);