import fs from 'node:fs';

const schema = fs.readFileSync('base44/entities/Donation.jsonc', 'utf8');
const view = fs.readFileSync('base44/functions/getCampaignDonationView/entry.ts', 'utf8');
const analytics = fs.readFileSync('src/pages/Analytics.jsx', 'utf8');
const campaignDetail = fs.readFileSync('src/pages/CampaignDetail.jsx', 'utf8');
const inbox = fs.readFileSync('src/pages/Inbox.jsx', 'utf8');
const deletion = fs.readFileSync('base44/functions/deleteAccount/entry.ts', 'utf8');

const allSource = [schema, view, analytics, campaignDetail, inbox, deletion].join('\n');

const required = [
  ['Donation read is no longer unrestricted', /"read"\s*:\s*\{\s*"\$or"/s],
  ['Donation read permits donor ownership', /"data\.donor_user_id"\s*:\s*"\{\{user\.id\}\}"/],
  ['Donation read permits admin operations', /"user_condition"\s*:\s*\{\s*"role"\s*:\s*"admin"/s],
  ['Donation delete is disabled for entity-level client/API access', /"delete"\s*:\s*false/],
  ['Authorized view uses service role for campaign query', /base44\.asServiceRole\.entities\.Donation\.filter/],
  ['Authorized view verifies campaign ownership', /campaign\.created_by_id\s*===\s*user\.id/],
  ['Public projection is explicitly minimized', /const publicFields = \['id', 'campaign_id', 'amount', 'created_date'\]/],
  ['Public projection excludes donor identity', !/const publicFields\s*=\s*[^;]*(?:donor_name|message)/s],
  ['Owner projection explicitly contains donor-sensitive fields', /const ownerFields = \[\s*\.\.\.publicFields,\s*'donor_name',\s*'message'/s],
  ['Analytics uses authorized view', /functions\.invoke\("getCampaignDonationView"/],
  ['Campaign detail uses authorized view', /functions\.invoke\("getCampaignDonationView"/],
  ['Inbox uses authorized view', /functions\.invoke\("getCampaignDonationView"/],
  ['Account deletion uses the service-role Donation API', /admin\.entities\.Donation\.deleteMany\s*\(/],
  ['Account deletion does not use a client-level Donation delete call', !/base44\.entities\.Donation\.delete(?:Many)?\s*\(/s],
];

for (const [label, pattern] of required) {
  const passed = pattern instanceof RegExp ? pattern.test(allSource) : pattern;
  if (!passed) {
    throw new Error(`Donation access boundary verification failed: ${label}`);
  }
}

for (const [label, source] of [
  ['Analytics', analytics],
  ['CampaignDetail', campaignDetail],
  ['Inbox', inbox],
]) {
  if (/entities\.Donation\.(filter|list|get|delete|deleteMany)\s*\(/.test(source)) {
    throw new Error(`${label} still performs direct Donation access outside the authorized view`);
  }
}

console.log('Donation access boundary static privacy verification passed.');
console.log('Service-role account deletion compatibility is present; approved retention/anonymization semantics and Development authorization testing remain required before publication.');
