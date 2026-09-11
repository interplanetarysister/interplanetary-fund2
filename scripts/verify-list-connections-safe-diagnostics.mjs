import fs from 'node:fs';

const source = fs.readFileSync('base44/functions/listConnections/entry.ts', 'utf8');

const required = [
  "Response.json({ error: 'Could not load connections.' }, { status: 500 })",
  "diagnosticType(error)",
  "if (!Array.isArray(list))",
  "redactCredentials(c.credentials)",
];
for (const token of required) {
  if (!source.includes(token)) throw new Error(`missing contract: ${token}`);
}
if (/error\.message|JSON\.stringify\(error\)|console\.error\([^\n]*error\s*\)/.test(source)) {
  throw new Error('raw error disclosure pattern found');
}
if (!source.includes("case 'object': return error === null ? 'null' : 'object';")) {
  throw new Error('null/object diagnostic classification missing');
}
console.log('listConnections safe-diagnostics contract passed');
