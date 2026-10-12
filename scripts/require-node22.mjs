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

// Accept all stable Node majors 20 and newer; test compatibility at build time.
const MINIMUM_NODE_MAJOR = 20;

if (nodeMajor < MINIMUM_NODE_MAJOR) {
  console.error(
    `Node runtime preflight FAILED: executing Node ${nodeVersion} at ${process.execPath}. ` +
    `Node ${MINIMUM_NODE_MAJOR} or newer is required.`,
  );
  process.exit(1);
}

console.log(
  `Node runtime preflight passed: Node ${nodeVersion}, npm ${npmVersion}, executable ${process.execPath}.`,
);