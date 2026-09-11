import fs from 'node:fs';

const source = fs.readFileSync('base44/shared/auditLog.ts', 'utf8');
const required = [
  ['classifier present', source.includes('function classifyAuditFailure')],
  ['no raw message access', !source.includes('error.message') && !source.includes('e.message')],
  ['no raw object logging', !source.includes('console.error(\'logAudit failed:\', error)')],
  ['error classification', source.includes("error instanceof Error")],
  ['string classification', source.includes("typeof error === 'string'")],
  ['non-throwing contract', source.includes('Failures are logged but never')],
];

for (const [name, ok] of required) {
  if (!ok) throw new Error(`audit-log safety check failed: ${name}`);
}

console.log('audit-log safe diagnostics verifier passed');
