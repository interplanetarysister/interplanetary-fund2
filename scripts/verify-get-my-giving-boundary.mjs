import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('base44/functions/getMyGiving/entry.ts', 'utf8');
const checks = [
  ['POST-only boundary', /req\?\.method !== 'POST'/],
  ['body allowlist', /ALLOWED_KEYS = new Set\(\[''\]\)/],
  ['strict IDs', /function requiredId\(value\)/],
  ['strict amounts', /typeof value !== 'number' \|\| !Number\.isFinite\(value\)/],
  ['strict booleans', /function safeBoolean\(value\)/],
  ['safe dates', /function safeDate\(value\)/],
  ['confirmed-only filter', /payment_verified: true/],
  ['allowlisted projection', /function projectDonation\(row, userId\)/],
  ['safe diagnostics', /console\.error\('getMyGiving error:', diagnosticType\(error\)\)/],
];
for (const [label, pattern] of checks) {
  if (!pattern.test(source)) throw new Error(`missing ${label}`);
}

const transformed = source
  .replace(/import[^;]+;\n/, '')
  .replace(/export default async function/, 'async function handler');
const context = {
  console: { error() {} },
  Response,
  JSON,
  Date,
  Math,
  Number,
  Object,
  Array,
  Set,
  RegExp,
};
vm.createContext(context);
vm.runInContext(`${transformed}\nthis.handler = handler;`, context);

const req = (body, overrides = {}) => ({
  method: 'POST',
  body: body === undefined ? null : { async json() { return body; } },
  ...overrides,
});

const response = await context.handler(req(undefined));
if (response.status !== 500) throw new Error('missing mocked auth failure path');

const methodResponse = await context.handler(req(undefined, { method: 'GET' }));
if (methodResponse.status !== 405) throw new Error('method guard failed');

console.log('getMyGiving boundary verifier passed');
