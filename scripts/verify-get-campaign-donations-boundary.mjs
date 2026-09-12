import fs from 'node:fs';

const path = 'base44/functions/getCampaignDonations/entry.ts';
const source = fs.readFileSync(path, 'utf8');

const required = [
  "req.method !== 'POST'",
  "Allow: 'POST'",
  "Invalid request body",
  "Object.keys(body)",
  'MAX_ROWS + 1',
  'Array.isArray(allDonations)',
  'payment_verified === true',
  'diagnostic_type',
  'function projectDonation',
  'Object.prototype.toString.call(error)',
  'Number.isNaN(Date.parse(value))',
  "typeof row.id !== 'string' || !isSafeId(row.id)",
];
for (const token of required) {
  if (!source.includes(token)) throw new Error(`Missing boundary contract: ${token}`);
}

for (const forbidden of [
  'console.error(\'getCampaignDonations error:\', error.message)',
  'return Response.json({ donations: allDonations',
  'const body = await req.json().catch(() => ({}))',
  'id: typeof row.id === \'string\' && isSafeId(row.id) ? row.id.trim() : undefined',
]) {
  if (source.includes(forbidden)) throw new Error(`Forbidden unsafe pattern remains: ${forbidden}`);
}

console.log('getCampaignDonations boundary contract verified');
