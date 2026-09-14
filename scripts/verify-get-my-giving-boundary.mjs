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

const validRow = {
  id: 'donation-1', donor_user_id: 'user-1', campaign_id: 'campaign-1',
  campaign_title: 'Campaign', amount: 12.34, donor_name: 'Donor',
  is_recurring: false, payment_method: 'card',
  created_date: '2026-01-02T03:04:05.000Z', payment_verified: true,
  pending_secret: 'must-not-escape',
};

function installClient({ auth = { user: { id: 'user-1' } }, rows = [validRow], filterArgs = [], filterError = null } = {}) {
  context.createClientFromRequest = () => ({
    auth: {
      async me() {
        if (auth.throwValue !== undefined) throw auth.throwValue;
        return auth.user;
      },
    },
    asServiceRole: {
      entities: {
        Donation: {
          async filter(...args) {
            filterArgs.push(args);
            if (filterError !== null) throw filterError;
            return rows;
          },
        },
      },
    },
  });
}

installClient({ auth: { throwValue: new Error('auth-secret') } });
const authFailure = await context.handler(req(undefined));
if (authFailure.status !== 500) throw new Error('auth-provider failure contract failed');
if ((await authFailure.text()).includes('auth-secret')) throw new Error('auth exception leaked');

installClient();
const success = await context.handler(req(undefined));
if (success.status !== 200) throw new Error('authenticated success failed');
const successBody = await success.json();
if (successBody.donations.length !== 1 || successBody.donations[0].id !== 'donation-1') throw new Error('projection failed');
if (JSON.stringify(successBody).includes('pending_secret')) throw new Error('raw provider field leaked');

for (const invalidBody of [{ unexpected: true }, [], 'text', 1]) {
  const malformed = await context.handler(req(invalidBody));
  if (malformed.status !== 400) throw new Error('malformed body accepted');
}

const methodResponse = await context.handler(req(undefined, { method: 'GET' }));
if (methodResponse.status !== 405) throw new Error('method guard failed');
if (methodResponse.headers.get('allow') !== 'POST') throw new Error('allow header missing');

const malformedRow = { ...validRow, amount: '12.34' };
installClient({ rows: [malformedRow] });
const malformedRowResponse = await context.handler(req(undefined));
if (malformedRowResponse.status !== 502) throw new Error('malformed provider row not rejected');

const throwingRow = {};
Object.defineProperty(throwingRow, 'id', { get() { throw new Error('getter-secret'); } });
installClient({ rows: [throwingRow] });
const hostileRowResponse = await context.handler(req(undefined));
if (hostileRowResponse.status !== 500 && hostileRowResponse.status !== 502) throw new Error('hostile row failure contract failed');
if ((await hostileRowResponse.text()).includes('getter-secret')) throw new Error('hostile getter leaked');

installClient({ rows: Array.from({ length: 1001 }, () => validRow) });
const oversizedResponse = await context.handler(req(undefined));
if (oversizedResponse.status !== 502) throw new Error('oversized provider response not rejected');

installClient({ filterError: new Error('provider-secret') });
const providerFailure = await context.handler(req(undefined));
if (providerFailure.status !== 500) throw new Error('provider failure status failed');
if ((await providerFailure.text()).includes('provider-secret')) throw new Error('provider exception leaked');

const otherUserRow = { ...validRow, donor_user_id: 'other-user' };
installClient({ rows: [otherUserRow] });
const ownershipResponse = await context.handler(req(undefined));
if (ownershipResponse.status !== 502) throw new Error('cross-user row not rejected');

const filterArgs = [];
installClient({ filterArgs });
await context.handler(req(undefined));
const filter = filterArgs[0];
if (!filter || filter[0]?.payment_verified !== true || filter[0]?.donor_user_id !== 'user-1') throw new Error('confirmed owner filter missing');

console.log('getMyGiving boundary verifier passed');
