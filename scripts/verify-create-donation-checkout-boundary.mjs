import fs from 'node:fs';

const source = fs.readFileSync('base44/functions/createDonationCheckout/entry.ts', 'utf8');

const required = [
  "if (req.method !== 'POST')",
  "const ALLOWED_KEYS = new Set",
  "SAFE_ORIGINS = new Set",
  "diagnosticType(error)",
  "typeof body.is_recurring !== 'boolean'",
  "typeof body.platform_contribution !== 'boolean'",
  "originUrl.protocol !== 'https:'",
  "campaign lookup failed",
  "provider response invalid",
  "encodeURIComponent(campaignId)",
  "typeof session.url !== 'string'",
  "return Response.json({ url: session.url })",
];
for (const needle of required) {
  if (!source.includes(needle)) throw new Error(`missing contract: ${needle}`);
}
if (source.includes('error?.message || error')) throw new Error('raw error disclosure remains');
if (source.includes('campaign_id}?donation=success')) throw new Error('unencoded campaign redirect remains');
console.log('createDonationCheckout boundary contract verified');
