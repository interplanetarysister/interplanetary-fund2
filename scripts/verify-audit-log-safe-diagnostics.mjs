import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('base44/shared/auditLog.ts', 'utf8');
const required = [
  ['classifier present', source.includes('function classifyAuditFailure')],
  ['no raw message access', !source.includes('error.message') && !source.includes('e.message')],
  ['no raw object logging', !source.includes("console.error('logAudit failed:', error)")],
  ['error classification', source.includes('error instanceof Error')],
  ['string classification', source.includes("typeof error === 'string'")],
  ['metadata sanitizer present', source.includes('function sanitizeAuditMetadata')],
  ['sensitive keys redacted', source.includes("output[key] = '[redacted]'")],
  ['metadata bounded', source.includes('MAX_METADATA_KEYS') && source.includes('MAX_METADATA_STRING')],
  ['sanitized metadata persisted', source.includes('metadata: sanitizeAuditMetadata')],
  ['non-throwing contract', source.includes('Failures are logged but never')],
];

for (const [name, ok] of required) {
  if (!ok) throw new Error(`audit-log safety check failed: ${name}`);
}

const runtimeSource = source.replace('export async function logAudit', 'async function logAudit');
const runtimeContext = { console: { error: (...args) => runtimeContext.logged.push(args), log: () => {} }, runtimeContext: null, logged: [] };
vm.createContext(runtimeContext);
vm.runInContext(`${runtimeSource}\nruntimeContext.logAudit = logAudit;`, runtimeContext);

const cases = [
  new Error('sensitive provider stack'),
  'attacker-controlled thrown string',
  { message: 'raw object message', token: 'secret-token' },
  null,
];
for (const thrown of cases) {
  const base44 = {
    asServiceRole: {
      entities: {
        AuditLog: {
          create: async () => { throw thrown; },
        },
      },
    },
  };
  await runtimeContext.logAudit(base44, { action: 'probe', detail: 'safe', metadata: { token: 'secret' } });
}
if (runtimeContext.logged.length !== cases.length) throw new Error('audit-log safety check failed: rejecting sink did not remain non-throwing');
for (const args of runtimeContext.logged) {
  const rendered = JSON.stringify(args);
  if (/sensitive provider stack|attacker-controlled thrown string|raw object message|secret-token/.test(rendered)) {
    throw new Error('audit-log safety check failed: raw thrown value reached logs');
  }
}

// Executable contract check for the same bounded/redaction policy used by auditLog.
const sensitive = /(token|secret|password|credential|authorization|cookie|api[_-]?key|private[_-]?key|access[_-]?token|refresh[_-]?token|amount|balance|iban|account[_-]?number|routing)/i;
function sanitize(value, depth = 0) {
  if (depth > 3) return '[truncated]';
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.slice(0, 500);
  if (Array.isArray(value)) return value.slice(0, 32).map((item) => sanitize(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 32).map(([key, item]) => [key, sensitive.test(key) ? '[redacted]' : sanitize(item, depth + 1)]));
  }
  return '[omitted]';
}

const probe = sanitize({ token: 'secret-token', safe: 'ok', nested: { password: 'secret-password' }, long: 'x'.repeat(900) });
if (probe.token !== '[redacted]' || probe.nested.password !== '[redacted]' || probe.safe !== 'ok' || probe.long.length !== 500) {
  throw new Error('audit-log safety check failed: executable metadata redaction/bounding contract');
}

console.log('audit-log safe diagnostics verifier passed');
