import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('src/components/platform/ServiceHealthPanel.jsx', 'utf8');

function extractFunction(name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`missing ${name}`);
  const open = source.indexOf('{', start);
  if (open < 0) throw new Error(`missing body for ${name}`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  let template = false;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '`') { template = !template; continue; }
    if (template) continue;
    if (ch === '{') depth += 1;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unclosed body for ${name}`);
}

const required = [
  ['safe service error constant', source.includes('SAFE_SERVICE_ERROR')],
  ['raw exception not rendered', !source.includes('error: e.message')],
  ['bounded failure classifier', source.includes('function classifyServiceFailure(value)')],
  ['fixed failure vocabulary', source.includes('const FAILURE_TYPES = new Set([') && source.includes('return FAILURE_TYPES.has(type) ? type : "object"')],
  ['classifier avoids raw value serialization', !source.includes('JSON.stringify(e)')],
  ['sanitized service name helper', source.includes('function sanitizeServiceName(name)')],
  ['safe service-name validation', source.includes('/^[A-Za-z0-9 &-]{1,64}$/')],
  ['single bounded diagnostic argument', source.includes('console.error(`Service health check failed for ${sanitizeServiceName(s.name)} (${failureType}).`)')],
  ['safe error rendered', source.includes('error: SAFE_SERVICE_ERROR')],
];

const failures = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failures.length) {
  console.error(`Service-health safe-error verification failed: ${failures.join(', ')}`);
  process.exit(1);
}

const context = { console: { error: (...args) => context.logs.push(args) }, logs: [] };
vm.createContext(context);
vm.runInContext(`${extractFunction('classifyServiceFailure')}\n${extractFunction('sanitizeServiceName')}\nthis.classifyServiceFailure = classifyServiceFailure;\nthis.sanitizeServiceName = sanitizeServiceName;`, context, { timeout: 1000 });

const values = [null, undefined, new Error('secret'), 'x', 1, true, 1n, Symbol('x'), () => {}, {}, new Proxy({}, { get() { throw new Error('getter touched'); }, getOwnPropertyDescriptor() { throw new Error('descriptor touched'); }, ownKeys() { throw new Error('keys touched'); } })];
const expected = ['nullish', 'nullish', 'error', 'string', 'number', 'boolean', 'bigint', 'symbol', 'function', 'object', 'object'];
values.forEach((value, index) => {
  const actual = context.classifyServiceFailure(value);
  if (actual !== expected[index]) throw new Error(`unexpected failure type at ${index}: ${actual}`);
});

const hostileName = new Proxy({}, { get() { throw new Error('name getter touched'); }, getOwnPropertyDescriptor() { throw new Error('name descriptor touched'); } });
if (context.sanitizeServiceName(hostileName) !== 'unknown-service') throw new Error('hostile service name was not rejected');
if (context.sanitizeServiceName('Identity & Auth') !== 'Identity & Auth') throw new Error('valid service name was rejected');
if (context.sanitizeServiceName('bad\\nlog') !== 'unknown-service') throw new Error('log-injection service name was accepted');

const simulatedFailure = context.classifyServiceFailure(new Proxy({}, { get() { throw new Error('failure getter touched'); } }));
const name = context.sanitizeServiceName('Campaign OS');
const diagnostic = `Service health check failed for ${name} (${simulatedFailure}).`;
context.console.error(diagnostic);
if (context.logs.length !== 1 || context.logs[0].length !== 1) throw new Error('diagnostic logger contract changed');
if (context.logs[0][0] !== diagnostic || /failure getter touched|secret|\\n/.test(context.logs[0][0])) throw new Error('unsafe diagnostic content emitted');

console.log('Service-health safe-error verification passed.');
