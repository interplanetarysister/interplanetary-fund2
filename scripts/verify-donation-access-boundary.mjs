import fs from 'node:fs';

const schema = fs.readFileSync('base44/entities/Donation.jsonc', 'utf8');
const view = fs.readFileSync('base44/functions/getCampaignDonationView/entry.ts', 'utf8');
const analytics = fs.readFileSync('src/pages/Analytics.jsx', 'utf8');
const campaignDetail = fs.readFileSync('src/pages/CampaignDetail.jsx', 'utf8');
const inbox = fs.readFileSync('src/pages/Inbox.jsx', 'utf8');

const required = [
  ['Donation read is no longer unrestricted', /"read"\s*:\s*\{\s*"\$or"/s],
  ['Donation read permits donor ownership', /"data\.donor_user_id"\s*:\s*"\{\{user\.id\}\}"/],
  ['Donation read permits admin operations', /"user_condition"\s*:\s*\{\s*"role"\s*:\s*"admin"/s],
  ['Donation delete is disabled', /"delete"\s*:\s*false/],
  ['Authorized view uses service role for campaign query', /base44\.asServiceRole\.entities\.Donation\.filter/],
  ['Authorized view verifies campaign ownership', /campaign\.created_by_id\s*===\s*user\.id/],
  ['Public projection excludes private financial fields', /const publicFields = \['id', 'campaign_id', 'amount', 'donor_name', 'message', 'created_date'\]/],
  ['Owner projection is explicitly bounded', /const ownerFields = \[\.\.\.publicFields, 'is_recurring', 'recurring_status', 'payment_method', 'is_institutional', 'cleared', 'withdrawal_id'\]/],
  ['Analytics uses authorized view', /functions\.invoke\("getCampaignDonationView"/],
  ['Campaign detail uses authorized view', /functions\.invoke\("getCampaignDonationView"/],
  ['Inbox uses authorized view', /functions\.invoke\("getCampaignDonationView"/],
];

for (const [label, pattern] of required) {
  if (!pattern.test(schema + '\n' + view + '\n' + analytics + '\n' + campaignDetail + '\n' + inbox)) {
    throw new Error(`Donation access boundary verification failed: ${label}`);
  }
}

for (const [label, source] of [
  ['Analytics', analytics],
  ['CampaignDetail', campaignDetail],
  ['Inbox', inbox],
]) {
  if (/entities\.Donation\.filter/.test(source)) {
    throw new Error(`${label} still performs a direct Donation query outside the authorized view`);
  }
}

console.log('Donation access boundary verification passed.');
