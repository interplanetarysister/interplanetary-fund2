import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('src/components/platform/ServiceHealthPanel.jsx', 'utf8');

function extractFunction(name) {
  const match = source.match(new RegExp(`function ${name}\\(.*?\\) \\{[\\s\\S]*?\\n\\}`));
  if (!match) throw new Error(`Missing ${name}`);
  return match[0];
}

const context = { Set, console };
vm.createContext(context);
vm.runInContext(`${extractFunction('classifyServiceFailure')}\\n${extractFunction('sanitizeServiceName')}\\nthis.classifyServiceFailure = classifyServiceFailure;\\nthis.sanitizeServiceName = sanitizeServiceName;`, context, { timeout: 1000 });

const expected = new Map([
  [null, 'nullish'],
  [undefined, 'nullish'],
  [new Error('secret'), 'object'],
  ['secret', 'string'],
  [1, 'number'],
  [true, 'boolean'],
  [1n, 'bigint'],
  [Symbol('secret'), 'symbol'],
  [function secret() {}, 'function'],
  [{ message: 'secret' }, 'object'],
]);

for (const [value, expectedType] of expected) {
  const actual = context.classifyServiceFailure(value);
  if (actual !== expectedType) throw new Error(`Unexpected classification: ${actual} !== ${expectedType}`);
}

let getterReads = 0;
const hostile = new Proxy({}, {
  get() { getterReads += 1; throw new Error('getter touched'); },
  ownKeys() { throw new Error('ownKeys touched'); },
  getOwnPropertyDescriptor() { throw new Error('descriptor touched'); },
});
if (context.classifyServiceFailure(hostile) !== 'object') throw new Error('Hostile proxy classification changed');
if (getterReads !== 0) throw new Error('Classifier touched hostile getter');

const safeNames = ['Identity & Auth', 'Campaign OS', 'A-1'];
for (const name of safeNames) {
  if (context.sanitizeServiceName(name) !== name) throw new Error(`Safe service name rejected: ${name}`);
}
for (const name of ['bad\\nname', 'bad\\tname', 'secret:token', '', 'x'.repeat(65), 'snowman ☃']) {
  if (context.sanitizeServiceName(name) !== 'unknown-service') throw new Error(`Hostile service name accepted: ${JSON.stringify(name)}`);
}

const requiredLiterals = [
  'status: "degraded"',
  'error: SAFE_SERVICE_ERROR',
  'Math.round(performance.now() - start)',
  'logPlatformEvent({',
  'outcome: failed.length ? "warning" : "success"',
];
for (const literal of requiredLiterals) {
  if (!source.includes(literal)) throw new Error(`Missing behavior contract: ${literal}`);
}

if (source.includes('console.error(e') || source.includes('console.error(error') || source.includes('JSON.stringify(e)')) {
  throw new Error('Raw exception sink detected');
}

console.log('Service-health runtime contract verification passed.');
