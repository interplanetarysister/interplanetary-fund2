import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

const REWARD_MS = 30 * 24 * 60 * 60 * 1000;
const isUnsubscribedNewMember = (user: any) => {
  const activeSubscription = ['active', 'trialing', 'past_due'].includes(String(user.subscription_status || ''));
  const paidHistory = Boolean(user.first_paid_subscription_at || user.paypal_subscription_id ||
    user.stripe_subscription_id || user.stripe_customer_id);
  const usedIntroOffer = Boolean(user.premium_trial_started_at || user.trial_end ||
    user.referral_reward_redeemed_at || user.referral_reward_code);
  const dayPass = Boolean(user.stripe_day_pass_checkout_id ||
    Date.parse(String(user.premium_day_pass_expires_at || '')) > Date.now());
  return !activeSubscription && !paidHistory && !usedIntroOffer && !dayPass;
};

// This route is called only after a real member signs in. The QR always lands on
// the public homepage first; no scan alone creates an account or redeems a card.
export default async function(req: Request) {
  if (req.method !== 'POST') return Response.json({ error: 'POST required.' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;
    if (user.role === 'admin') return Response.json({ error: 'Admin access is already included.' }, { status: 409 });
    const input = await req.json().catch(() => ({}));
    const code = String(input.code || '').trim().toUpperCase();
    if (!/^IF-[A-F0-9]{24}$/.test(code)) return Response.json({ error: 'Invalid referral code.' }, { status: 400 });
    const sr = base44.asServiceRole;
    if (user.referral_reward_code === code && user.referral_reward_redeemed_at) {
      return Response.json({
        ok: true, already_redeemed: true, tier: 'basic',
        expires_at: user.referral_basic_expires_at, charged: false, renewal_scheduled: false,
      }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (!isUnsubscribedNewMember(user)) {
      return Response.json({ error: 'This offer is for new members who have not used a trial, referral reward, or subscription.' }, { status: 409 });
    }
    const cards = await sr.entities.ReferralCard.filter({ code });
    const card = (cards || []).find((c: any) => c.code === code);
    if (!card || card.status === 'revoked') return Response.json({ error: 'This referral code is unavailable.' }, { status: 404 });
    if (card.reward_tier !== 'basic' || card.reward_days !== 30) {
      return Response.json({ error: 'This referral offer is unavailable.' }, { status: 409 });
    }
    // Compare-and-update by id AND available state. Another claimant cannot
    // overwrite an earlier claim; a retry by the same member can recover if
    // awarding entitlements failed after the first claim.
    if (card.status === 'available') {
      await sr.entities.ReferralCard.updateMany(
        { id: card.id, status: 'available' },
        { $set: {
          status: 'redeemed', redeemed_by_user_id: user.id,
          redeemed_at: new Date().toISOString(),
        } },
      );
    }
    const claimed = await sr.entities.ReferralCard.get(card.id);
    if (claimed?.status !== 'redeemed' || claimed.redeemed_by_user_id !== user.id) {
      return Response.json({ error: 'This card has already been redeemed.' }, { status: 409 });
    }
    const fresh = await sr.entities.User.get(user.id);
    if (!fresh || fresh.account_deletion_pending || (fresh.account_status && fresh.account_status !== 'active')) {
      return Response.json({ error: 'Account unavailable.' }, { status: 403 });
    }
    if (fresh.referral_reward_code && fresh.referral_reward_code !== code) {
      return Response.json({ error: 'A referral reward was already redeemed.' }, { status: 409 });
    }
    if (!fresh.referral_reward_code && !isUnsubscribedNewMember(fresh)) {
      return Response.json({ error: 'This account is no longer eligible for the referral.' }, { status: 409 });
    }
    const redeemedAt = String(claimed.redeemed_at || new Date().toISOString());
    const expiresAt = new Date(Date.parse(redeemedAt) + REWARD_MS).toISOString();
    await sr.entities.User.update(user.id, {
      referral_reward_code: code,
      referral_reward_redeemed_at: redeemedAt,
      referral_basic_expires_at: expiresAt,
    });
    await sr.entities.AuditLog.create({
      action: 'referral_card_redeemed', actor_user_id: user.id,
      target_type: 'referral_card', target_id: card.id,
      status: 'success', detail: '30-day Basic referral access granted.',
    }).catch(() => null);
    return Response.json({
      ok: true, tier: 'basic', expires_at: expiresAt,
      charged: false, renewal_scheduled: false,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('redeemReferralCard:', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ error: 'The referral could not be redeemed. Please retry.' }, { status: 503 });
  }
}
