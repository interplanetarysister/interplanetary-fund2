import fs from 'node:fs';

const source = fs.readFileSync('src/components/campaigns/ShareCampaignKit.jsx', 'utf8');

const required = [
  'function escapeHtml',
  'function buildEmbedMarkup',
  'width=\\"100%\\"',
  'max-width:340px',
  'min-height:420px',
  'loading=\\"lazy\\"',
  'referrerpolicy=\\"strict-origin-when-cross-origin\\"',
  'noopener noreferrer',
  'navigator.clipboard.writeText',
  'copied === "error"',
];

for (const pattern of required) {
  if (!source.includes(pattern)) {
    throw new Error(`Campaign embed contract missing: ${pattern}`);
  }
}

if (!source.includes('replace(/&/g, "&amp;")') || !source.includes('replace(/\\\"/g, "&quot;")')) {
  throw new Error('Campaign embed contract must escape campaign-derived HTML attributes.');
}

if (source.includes('width=\\"340\\" height=\\"420\\" style=\\"border:0')) {
  throw new Error('Campaign iframe copy must not rely on the old fixed-size embed markup.');
}

console.log('Campaign embed contract verification passed.');
