import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('src/components/platform/ServiceHealthPanel.jsx', 'utf8');

function extractFunction(name) {
  const signature = new RegExp(`function\\s+${name}\\s*\\(`);
  const match = signature.exec(source);
  if (!match) throw new Error(`Missing ${name}`);
  const openBrace = source.indexOf('{', match.index);
  if (openBrace < 0) throw new Error(`Missing body for ${name}`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = openBrace; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(match.index, i + 1);
    }
  }
  throw new Error(`Unclosed body for ${name}`);
}

const allowlistSource = source.match(/const FAILURE_TYPES = new Set\\(\\[([\\s\\S]*?)\\]\\);/);
if (!allowlistSource) throw new Error('Missing FAILURE_TYPES allowlist');
const context = { Set, console };
vm.createContext(context);
const harness = [
  allowlistSource[0],
  extractFunction('classifyServiceFailure'),
  extractFunction('sanitizeServiceName'),
  'this.classifyServiceFailure = classifyServiceFailure;',
  'this.sanitizeServiceName = sanitizeServiceName;',
].join('\n');
vm.runInContext(harness, context, { timeout: 1000 });

const expected = new Map([
  [null, 'nullish'],
  [undefined, 'nullish'],
  [new Error('secret'), 'object'],
  [new TypeError('secret'), 'object'],
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

const hostileTag = new Proxy({}, {
  get(target, key) {
    if (key === Symbol.toStringTag) throw new Error('toStringTag touched');
    return Reflect.get(target, key);
  },
});
if (context.classifyServiceFailure(hostileTag) !== 'object') throw new Error('Hostile toStringTag classification changed');

const safeNames = ['Identity & Auth', 'Campaign OS', 'A-1'];
for (const name of safeNames) {
  if (context.sanitizeServiceName(name) !== name) throw new Error(`Safe service name rejected: ${name}`);
}
for (const name of ['bad\nname', 'bad\tname', 'secret:token', '', 'x'.repeat(65), 'snowman ☃', '\u0000bad']) {
  if (context.sanitizeServiceName(name) !== 'unknown-service') throw new Error(`Hostile service name accepted: ${JSON.stringify(name)}`);
}

const sourceContracts = [
  ['status: "degraded"', source.includes('status: "degraded"')],
  ['error: SAFE_SERVICE_ERROR', source.includes('error: SAFE_SERVICE_ERROR')],
  ['Math.round(performance.now() - start)', source.includes('Math.round(performance.now() - start)')],
  ['logPlatformEvent({', source.includes('logPlatformEvent({')],
  ['outcome: failed.length ? "warning" : "success"', source.includes('outcome: failed.length ? "warning" : "success"')],
  ['const failed = out.filter((r) => r.status !== "operational")', source.includes('const failed = out.filter((r) => r.status !== "operational")')],
  ['const out = await Promise.all(', source.includes('const out = await Promise.all(')],
  ['setRunning(false);', source.includes('setRunning(false);')],
];
for (const [literal, ok] of sourceContracts) {
  if (!ok) throw new Error(`Missing behavior contract: ${literal}`);
}

const diagnostics = [];
const fakeConsole = { error(...args) { diagnostics.push(args); } };
const fakePerformance = { now: (() => { let tick = 10; return () => (tick += 7); })() };
const fakeServices = [
  { name: 'Good Service', check: async () => undefined },
  { name: 'Bad\nService', check: async () => { throw new Proxy({}, { get() { throw new Error('must not inspect'); } }); } },
];
async function runFailurePath(service) {
  const start = fakePerformance.now();
  try {
    await service.check();
    return { name: service.name, status: 'operational', latency: Math.round(fakePerformance.now() - start) };
  } catch (e) {
    const failureType = context.classifyServiceFailure(e);
    fakeConsole.error(`Service health check failed for ${context.sanitizeServiceName(service.name)} (${failureType}).`);
    return { name: service.name, status: 'degraded', latency: Math.round(fakePerformance.now() - start), error: 'Service health check failed.' };
  }
}
const results = await Promise.all(fakeServices.map(runFailurePath));
if (results[0].status !== 'operational' || typeof results[0].latency !== 'number') throw new Error('Operational result contract changed');
if (results[1].status !== 'degraded' || results[1].error !== 'Service health check failed.') throw new Error('Degraded result contract changed');
if (diagnostics.length !== 1 || diagnostics[0].length !== 1) throw new Error('Diagnostic logger argument contract changed');
if (diagnostics[0][0] !== 'Service health check failed for unknown-service (object).') throw new Error('Diagnostic content is not bounded and sanitized');

if (source.includes('console.error(e') || source.includes('console.error(error') || source.includes('JSON.stringify(e)')) {
  throw new Error('Raw exception sink detected');
}

const diagnosticMatch = source.match(/console\\.error\\(`([^`]+)`\\);/);
if (!diagnosticMatch) throw new Error('Missing bounded diagnostic console call');
if (!diagnosticMatch[1].includes('sanitizeServiceName(s.name)')) throw new Error('Diagnostic does not sanitize service name');
if (!diagnosticMatch[1].includes('(\\${failureType})')) throw new Error('Diagnostic does not use bounded failure type');

console.log('Service-health runtime contract verification passed.');
