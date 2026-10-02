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

// General project policy accepts Node 20 and newer. Provider-specific lanes may pin a known-compatible runtime.
const MINIMUM_SUPPORTED = 20;

if (nodeMajor < MINIMUM_SUPPORTED) {
  console.error(
    `Node runtime preflight FAILED: executing Node ${nodeVersion} at ${process.execPath}. ` +
    `Supported runtimes: Node ${MINIMUM_SUPPORTED} and newer. ` +
    'Select a supported runtime before install, build, typecheck, lint, or verification.',
  );
  process.exit(1);
}

console.log(
  `Node runtime preflight passed: Node ${nodeVersion}, npm ${npmVersion}, executable ${process.execPath}.`,
);