import fs from 'node:fs';

const file = 'base44/functions/validateIntegrationHealth/entry.ts';
const src = fs.readFileSync(file, 'utf8');

const forbidden = [
  /err\.message/,
  /e\.message/,
  /error\.message/,
  /lastFailure\s*=\s*`[^`]*\$\{[^}]*message/,
  /detail:\s*[^\n]*(?:err|error|e)\.message/,
];
for (const pattern of forbidden) {
  if (pattern.test(src)) throw new Error(`${file}: raw exception detail pattern remains: ${pattern}`);
}

for (const required of [
  'safeThrownKind',
  'safeFailure',
  'isValidRegistryEntry',
  'classifyProbePayload',
  'Array.isArray(rawEntries)',
  "req.method !== 'POST'",
  "probeRes.ok",
  "probeStatus !== 'success'",
  "SAFE_FAILURE",
]) {
  if (!src.includes(required)) throw new Error(`${file}: required boundary contract missing: ${required}`);
}

if (/console\.error\([^\n]*(?:err|error|e)\.message/.test(src)) {
  throw new Error(`${file}: raw exception detail reaches logging sink`);
}

console.log('validateIntegrationHealth safe-boundary contract passed.');
