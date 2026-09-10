import fs from 'node:fs';

const source = fs.readFileSync('base44/shared/auditLog.ts', 'utf8');
const required = [
  ['diagnostic type helper', source.includes('function diagnosticType')],
  ['no raw error message logging', !source.includes('e.message') && !source.includes('error.message')],
  ['no object fallback logging', !source.includes("? e.message : e") && !source.includes('? error.message : error')],
  ['audit failures remain non-throwing', source.includes('catch (error)') && source.includes("console.error('logAudit failed:', diagnosticType(error));")],
];

for (const [label, ok] of required) {
  if (!ok) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

if (!process.exitCode) console.log('Audit log diagnostics contract verified.');
