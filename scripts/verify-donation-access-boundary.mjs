import assert from 'node:assert/strict';
import fs from 'node:fs';

const schema = JSON.parse(fs.readFileSync('base44/entities/Donation.jsonc', 'utf8'));
const view = fs.readFileSync('base44/functions/getCampaignDonationView/entry.ts', 'utf8');
const analytics = fs.readFileSync('src/pages/Analytics.jsx', 'utf8');
const campaignDetail = fs.readFileSync('src/pages/CampaignDetail.jsx', 'utf8');
const inbox = fs.readFileSync('src/pages/Inbox.jsx', 'utf8');
const deletion = fs.readFileSync('base44/functions/deleteAccount/entry.ts', 'utf8');

const readPolicy = schema.rls?.read;
assert.ok(Array.isArray(readPolicy?.$or), 'Donation read must use an explicit OR authorization policy');
assert.ok(readPolicy.$or.some((rule) => rule?.['data.donor_user_id'] === '{{user.id}}'), 'Donation read must permit donor self-access');
assert.ok(readPolicy.$or.some((rule) => rule?.user_condition?.role === 'admin'), 'Donation read must permit admin access');
assert.equal(schema.rls?.delete, false, 'Donation entity deletion must be disabled; retention/anonymization uses an explicit server-side workflow');
assert.equal(schema.rls?.create?.user_condition?.role, 'admin', 'Donation creation must remain service/admin-authorized');

assert.match(view, /const publicFields\s*=\s*\['id',\s*'campaign_id',\s*'amount',\s*'created_date'\]/, 'Public donation projection must be minimized');
assert.match(view, /const ownerFields\s*=\s*\[[\s\S]*'donor_name',[\s\S]*'message'/, 'Owner projection must explicitly contain donor-sensitive fields');
assert.match(view, /base44\.asServiceRole\.entities\.Donation\.filter/, 'Authorized donation view must use service role only for the server-side query');
assert.match(view, /campaign\.created_by_id\s*===\s*user\.id/, 'Authorized donation view must verify campaign ownership');
assert.match(view, /const fields\s*=\s*isOwner\s*\|\|\s*isAdmin\s*\?\s*ownerFields\s*:\s*publicFields/, 'Donation projection must be authorization-dependent');

for (const [label, source] of [['Analytics', analytics], ['CampaignDetail', campaignDetail], ['Inbox', inbox]]) {
  assert.match(source, /functions\.invoke\("getCampaignDonationView"/, `${label} must use the authorized donation projection`);
  assert.doesNotMatch(source, /entities\.Donation\.(filter|list|get|delete|deleteMany)\s*\(/, `${label} must not perform direct Donation entity access`);
}

assert.match(deletion, /base44\.asServiceRole/, 'Account deletion must use the server-side service-role boundary');
assert.match(deletion, /admin\.entities\.Donation\.deleteMany\(/, 'The legacy deletion workflow must use the service-role Donation API when it performs retention cleanup');
assert.doesNotMatch(deletion, /base44\.entities\.Donation\.delete(?:Many)?\s*\(/, 'Account deletion must not use a client-level Donation delete call');

console.log('Donation access boundary static verification passed.');
console.log('Development authorization testing and approved retention/anonymization semantics remain separate publication gates.');
