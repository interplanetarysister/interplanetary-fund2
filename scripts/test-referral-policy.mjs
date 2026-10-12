import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canIssueReferralCard, referralRewardIsActive, REFERRAL_REWARD_TIER, REFERRAL_REWARD_DAYS } from '../base44/shared/referralPolicy.js';

const trialAt = '2026-10-01T12:00:00.000Z';
const paidAt = '2026-10-02T12:00:00.000Z';
const referred = {
  id: 'member-1', role: 'user', account_status: 'active', subscription_status: 'none',
  subscription_tier: 'enterprise', referral_reward_code: 'IF-'+'A'.repeat(24),
  referral_reward_redeemed_at: trialAt,
  referral_full_expires_at: '2026-10-31T12:00:00.000Z',
};
assert.equal(REFERRAL_REWARD_TIER, 'enterprise');
assert.equal(REFERRAL_REWARD_DAYS, 30);
assert.equal(referralRewardIsActive(referred, Date.parse('2026-10-02T12:00:00Z')), true);
assert.equal(referralRewardIsActive(referred, Date.parse('2026-11-01T12:00:00Z')), false);
assert.equal(canIssueReferralCard(referred), false, 'referral trial alone never unlocks sharing');
assert.equal(canIssueReferralCard({ ...referred, subscription_status: 'trialing' }), false);
assert.equal(canIssueReferralCard({ ...referred, subscription_status: 'past_due' }), false);
assert.equal(canIssueReferralCard({ ...referred, subscription_status: 'canceled' }), false);
const paying = {
  ...referred, subscription_status: 'active', subscription_tier: 'basic',
  first_paid_subscription_at: paidAt,
  subscription_provider: 'paypal', paypal_subscription_id: 'I-PAIDORDER1234',
};
assert.equal(canIssueReferralCard(paying), true, 'conversion to a provider-verified paid tier unlocks sharing');
assert.equal(canIssueReferralCard({ ...paying, referral_reward_code: '' }), false, 'no referral lineage');
assert.equal(canIssueReferralCard({ ...paying, first_paid_subscription_at: '2026-09-01T12:00:00Z' }), false);
assert.equal(canIssueReferralCard({ ...paying, subscription_provider: 'none' }), false);
assert.equal(canIssueReferralCard({ ...paying, paypal_subscription_id: '' }), false);
assert.equal(canIssueReferralCard({ ...paying, account_status: 'disabled' }), false);
assert.equal(canIssueReferralCard({ ...paying, account_deletion_pending: true }), false);
assert.equal(canIssueReferralCard({ ...paying, subscription_status: 'active', subscription_provider: 'stripe', stripe_subscription_id: 'sub_verified123', paypal_subscription_id: '' }), true);
assert.equal(canIssueReferralCard({ role: 'admin', account_status: 'active' }), true);

const schema = JSON.parse(readFileSync(new URL('../base44/entities/ReferralCard.jsonc', import.meta.url), 'utf8'));
assert.deepEqual(schema.properties.reward_tier.enum, ['enterprise']);
assert.equal(schema.properties.reward_days.default, 30);
assert.equal(schema.properties.status.enum.includes('redeemed'), true);
assert.equal(schema.properties.issued_by_user_id.type, 'string');
assert.equal(schema.properties.parent_referral_code.type, 'string');
for (const p of ['../base44/shared/subscriptionEntitlements.ts', '../src/lib/subscriptionEntitlements.js']) {
  const source = readFileSync(new URL(p, import.meta.url), 'utf8');
  assert.match(source, /referral_full_expires_at/);
  assert.match(source, /referralActive \? (?:TOP_SUBSCRIPTION_TIER|TOP_PLAN.id)/);
}
const issuer = readFileSync(new URL('../base44/functions/issueReferralCard/entry.ts', import.meta.url), 'utf8');
assert.match(issuer, /canIssueReferralCard\(guard\.user\)/);
assert.match(issuer, /parent_referral_code/);
const redeemer = readFileSync(new URL('../base44/functions/redeemReferralCard/entry.ts', import.meta.url), 'utf8');
assert.match(redeemer, /REFERRAL_REWARD_TIER/);
assert.match(redeemer, /referral_full_expires_at: expiresAt/);
assert.match(redeemer, /status: 'available'/);
console.log('IFund referral sharing policy and full-access contracts passed.');
