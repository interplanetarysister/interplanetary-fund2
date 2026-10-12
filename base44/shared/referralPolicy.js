// Business card referral rules, shared by the Base44 backend and IFund UI.
// A redeemed referral reward is NOT a payment and never qualifies a member
// to issue downstream rewards. Provider-confirmed paid status is required.
export const REFERRAL_REWARD_TIER = 'enterprise';
export const REFERRAL_REWARD_DAYS = 30;
export const REFERRAL_CODE_PATTERN = /^IF-[A-F0-9]{24}$/;

export function canIssueReferralCard(user) {
  if (!user || user.account_deletion_pending || (user.account_status && user.account_status !== 'active')) return false;
  if (user.role === 'admin') return true;
  // Referred members alone may distribute cards once they convert to paid.
  if (!user.referral_reward_code || !Number.isFinite(Date.parse(String(user.referral_reward_redeemed_at || '')))) return false;
  if (user.subscription_status !== 'active' || !['basic', 'outreach', 'professional', 'enterprise', 'nonprofit'].includes(user.subscription_tier)) return false;
  if (!Number.isFinite(Date.parse(String(user.first_paid_subscription_at || '')))) return false;
  if (Date.parse(String(user.first_paid_subscription_at)) < Date.parse(String(user.referral_reward_redeemed_at))) return false;
  // Only billing subscriptions reconciled by a provider can unlock issuance.
  if (user.subscription_provider === 'paypal' && Boolean(user.paypal_subscription_id)) return true;
  if (user.subscription_provider === 'stripe' && Boolean(user.stripe_subscription_id)) return true;
  return false;
}

export function referralRewardIsActive(user, now = Date.now()) {
  if (!user?.referral_reward_redeemed_at) return false;
  const expires = Date.parse(String(user.referral_full_expires_at || user.referral_basic_expires_at || ''));
  return Number.isFinite(expires) && expires > now;
}
