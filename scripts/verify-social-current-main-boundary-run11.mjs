import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Social.jsx', 'utf8');

const forbidden = [
  { label: 'failure-to-empty PlatformConnection', pattern: /PlatformConnection\.filter\(\{\}\)\.catch\(\(\)\s*=>\s*\[\]\)/ },
  { label: 'failure-to-empty Campaign', pattern: /Campaign\.filter\(\{\}\)\.catch\(\(\)\s*=>\s*\[\]\)/ },
  { label: 'client-derived admin gate', pattern: /user\?\.role\s*===\s*["']admin["']/ },
];

const failures = forbidden.filter(({ pattern }) => pattern.test(source));
if (failures.length) {
  console.error(
    `Social boundary guard FAILED: ${failures.map(({ label }) => label).join(', ')}`,
  );
  process.exit(1);
}

const requiredSignals = [
  'SAFE_SOCIAL_ERROR',
  'requestGeneration',
  'mountedRef',
];
const missing = requiredSignals.filter((signal) => !source.includes(signal));
if (missing.length) {
  console.error(
    `Social boundary guard FAILED: missing expected fail-closed signals: ${missing.join(', ')}`,
  );
  process.exit(1);
}

console.log('Social boundary guard passed.');
