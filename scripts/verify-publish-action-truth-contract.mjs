import assert from 'node:assert/strict';
import fs from 'node:fs';
import { safeExternalHttpsUrl } from '../base44/shared/safeExternalUrl.js';

const read = (path) => fs.readFileSync(path, 'utf8');
const publish = read('base44/functions/publishPost/entry.ts');
const create = read('base44/functions/createDistributedPost/entry.ts');
const capabilities = read('base44/shared/providerCapabilities.ts');
const list = read('base44/functions/listFundraisingProviderCapabilities/entry.ts');
const composer = read('src/components/social/PostComposer.jsx');
const dialog = read('src/components/social/ShareToProfileDialog.jsx');
const results = read('src/components/social/ExternalPublishingResults.jsx');

// The authenticated owner + exact post/campaign/connection chain is the
// server-side per-action authorization. Never trust a client consent flag.
assert.match(publish, /post\.created_by_id === campaign\.created_by_id/);
assert.match(publish, /connection\.created_by_id === campaign\.created_by_id/);
assert.match(publish, /user\.id === campaign\.created_by_id/);
assert.doesNotMatch(publish, /user_publish_authorized/);
assert.doesNotMatch(publish, /hasAiPublishingConsent|assertOboGrant|assertExternalAgentAction/);
assert.match(publish, /safeExternalHttpsUrl\(connection\.external_url\)/);
assert.match(publish, /profile_url: profileUrl/);

// UI and server consume derived eligibility from one shared, fresh-evidence
// decision that is also pinned to an implemented adapter.
assert.match(capabilities, /IMPLEMENTED_DIRECT_PUBLISH_ADAPTERS = new Set<string>\(\['bluesky'\]\)/);
assert.match(capabilities, /hasFreshPublishEvidence/);
assert.match(capabilities, /publish_test_account_reference/);
assert.match(capabilities, /PUBLISH_EVIDENCE_MAX_AGE_MS/);
assert.match(create, /hasImplementedDirectPublishAdapter\(capability\)/);
assert.match(create, /hasVerifiedManualShare\(capability\)/);
assert.match(publish, /hasImplementedDirectPublishAdapter\(capability\)/);
assert.match(list, /direct_publish_eligible: hasImplementedDirectPublishAdapter\(provider\)/);
assert.match(list, /manual_share_eligible: hasVerifiedManualShare\(provider\)/);
assert.match(composer, /cap\?\.direct_publish_eligible === true \|\| cap\?\.manual_share_eligible === true/);
assert.match(dialog, /cap\?\.direct_publish_eligible === true \|\| cap\?\.manual_share_eligible === true/);

// Manual and failed outcomes must remain visible and actionable, and the
// non-campaign share dialog must not offer destinations it cannot target.
assert.match(composer, /setExternalResults\(results\)/);
assert.match(dialog, /setExternalResults\(results\)/);
assert.match(composer, /outcome\?\.manual && outcome\?\.verified_manual === true/);
assert.match(dialog, /outcome\?\.manual && outcome\?\.verified_manual === true/);
assert.match(dialog, /campaignId && connectedSocial\.length > 0/);
assert.match(results, /Manual step needed/);
assert.match(results, /Copy post/);
assert.match(results, /Open profile/);
assert.match(results, /safeExternalHttpsUrl\(result\.profile_url\)/);
assert.match(results, /href=\{profileUrl\}/);
assert.equal(safeExternalHttpsUrl('javascript:alert(1)'), '');
assert.equal(safeExternalHttpsUrl('data:text/html,test'), '');
assert.equal(safeExternalHttpsUrl('http://example.com/profile'), '');
assert.equal(safeExternalHttpsUrl('https://user:pass@example.com/profile'), '');
assert.equal(safeExternalHttpsUrl('https://example.com/profile'), 'https://example.com/profile');

console.log('Per-post authorization, publish eligibility, and truthful handoff contract verified.');
