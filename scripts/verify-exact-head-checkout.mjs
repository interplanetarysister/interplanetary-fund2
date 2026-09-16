import { execFileSync } from 'node:child_process';

const shaPattern = /^[0-9a-f]{40}$/i;
const expected = String(process.env.EXPECTED_COMMIT_SHA ?? '').trim();

if (!shaPattern.test(expected)) {
  console.error('Exact-head checkout contract failed: EXPECTED_COMMIT_SHA must be a 40-character commit SHA.');
  process.exit(1);
}

let actual;
try {
  actual = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
} catch {
  console.error('Exact-head checkout contract failed: unable to resolve git HEAD.');
  process.exit(1);
}

if (!shaPattern.test(actual) || actual.toLowerCase() !== expected.toLowerCase()) {
  console.error(`Exact-head checkout contract failed: expected ${expected}, got ${actual || '<empty>'}.`);
  process.exit(1);
}

console.log(`Exact-head checkout verified: ${actual}`);
