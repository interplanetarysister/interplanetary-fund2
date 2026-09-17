import fs from 'node:fs';

const source = fs.readFileSync('base44/functions/listConnections/entry.ts', 'utf8');

const required = [
  "Response.json({ error: 'Could not load connections.' }, { status: 500 })",
  "diagnosticType(error)",
  "if (!Array.isArray(list))",
  "redactCredentials(connection.credentials)",
  "const PUBLIC_CONNECTION_FIELDS = [",
  "function projectConnection(connection)",
  "for (const connection of list)",
  "if (!projected)",
  "{ status: 502 }",
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
if (!source.includes("if (typeof value !== 'string') continue;")) {
  throw new Error('projected field type guard missing');
}
if (source.includes('return { ...c')) throw new Error('wholesale record spread remains');
console.log('listConnections safe-diagnostics contract passed');
