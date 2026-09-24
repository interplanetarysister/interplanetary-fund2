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

// Interplanetary Fund uses one runtime contract everywhere to prevent Base44/GitHub drift.\nconst SUPPORTED = [22];

if (!SUPPORTED.includes(nodeMajor)) {
  console.error(
    `Node runtime preflight FAILED: executing Node ${nodeVersion} at ${process.execPath}. ` +
    `Required runtime: Node ${SUPPORTED[0]}. ` +
    'Select a supported runtime before install, build, typecheck, lint, or verification.',
  );
  process.exit(1);
}

console.log(
  `Node runtime preflight passed: Node ${nodeVersion}, npm ${npmVersion}, executable ${process.execPath}.`,
);