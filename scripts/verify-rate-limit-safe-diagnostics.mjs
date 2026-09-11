import fs from 'node:fs';

const source = fs.readFileSync('base44/shared/rateLimit.ts', 'utf8');

const required = [
  'MAX_KEY_LENGTH',
  'MAX_WINDOW_SECONDS',
  'MAX_LIMIT',
  'diagnosticType',
  'safeKey',
  'safePositiveInteger',
  'normalizedKey',
  'normalizedMax',
  'normalizedWindow',
  "diagnostic_type: diagnosticType(error)",
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`Missing rate-limit safety contract: ${token}`);
  }
}

if (/console\\.error\\([^\\n]*e\\.message|console\\.error\\([^\\n]*,\\s*e\\)/.test(source)) {
  throw new Error('Raw rate-limit exception disclosure remains');
}

if (!source.includes('updateMany({ id: bucket.id }, { $inc: { count: 1 } })')) {
  throw new Error('Expected atomic increment path is missing');
}

// Execute the helper with a deterministic in-memory service-role double. This
// is intentionally dependency-free so it can run in CI without Base44.
const executable = source.replace('export async function checkRateLimit', 'async function checkRateLimit');
const factory = new Function(`${executable}; return checkRateLimit;`);
const checkRateLimit = factory();

function makeBase44(initial = []) {
  const rows = [...initial];
  return {
    rows,
    asServiceRole: {
      entities: {
        RateLimitBucket: {
          async filter() { return rows.slice(); },
          async create(data) { rows.push({ id: `bucket-${rows.length + 1}`, ...data }); return rows.at(-1); },
          async update(id, data) {
            const row = rows.find((candidate) => candidate.id === id);
            if (!row) throw new Error('missing row');
            Object.assign(row, data);
          },
          async updateMany({ id }, { $inc: increment }) {
            const row = rows.find((candidate) => candidate.id === id);
            if (!row) throw new Error('missing row');
            row.count += increment.count;
          },
        },
      },
    },
  };
}

const invalid = await checkRateLimit(makeBase44(), '  ', 10, 60);
if (!invalid.allowed || invalid.remaining !== 0) throw new Error('Invalid-input fail-open contract failed');

const firstUseBase = makeBase44();
const firstUse = await checkRateLimit(firstUseBase, 'actor:action', 2, 60);
if (!firstUse.allowed || firstUse.remaining !== 1 || firstUseBase.rows.length !== 1) {
  throw new Error('First-use limiter behavior failed');
}

const activeBase = makeBase44([{ id: 'bucket-1', key: 'actor:action', window_start: new Date().toISOString(), count: 0 }]);
const active = await checkRateLimit(activeBase, 'actor:action', 2, 60);
if (!active.allowed || active.remaining !== 1 || activeBase.rows[0].count !== 1) {
  throw new Error('Atomic increment contract failed');
}

const malformedBase = makeBase44([{ id: 'bucket-1', key: 'actor:action', window_start: 'not-a-date', count: 'bad' }]);
const malformed = await checkRateLimit(malformedBase, 'actor:action', 2, 60);
if (!malformed.allowed || malformed.remaining !== 1 || malformedBase.rows[0].count !== 1) {
  throw new Error('Malformed-bucket recovery contract failed');
}

console.log('rate-limit-safe-diagnostics executable contract passed');
