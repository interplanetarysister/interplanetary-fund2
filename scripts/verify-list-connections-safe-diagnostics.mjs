import fs from 'node:fs';

const source = fs.readFileSync('base44/functions/listConnections/entry.ts', 'utf8');

const required = [
  "Response.json({ error: 'Could not load connections.' }, { status: 500 })",
  "diagnosticType(error)",
  "if (!Array.isArray(list))",
  "redactCredentials(connection.credentials)",
  "const PUBLIC_CONNECTION_FIELDS = [",
  "function projectConnection(connection)",
  "const connections = list.map(projectConnection).filter(Boolean);",
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
if (!source.includes("if (typeof value === 'string' && value.length > 512) continue;")) {
  throw new Error('bounded response string contract missing');
}
if (!source.includes("if (['id', 'platform', 'status'")) {
  throw new Error('response field type guard missing');
}
console.log('listConnections safe-diagnostics contract passed');
