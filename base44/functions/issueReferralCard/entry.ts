import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { canIssueReferralCard, REFERRAL_REWARD_TIER, REFERRAL_REWARD_DAYS } from '../../shared/referralPolicy.js';

// Each share/printed card gets a separate, high-entropy URL to the real homepage.
// Admins and referred members with provider-confirmed active paid subscriptions
// may issue individual cards. No purchase or charge is created by this call.
const canonicalOrigin = 'https://interplanetaryfund.com';
const newCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return 'IF-' + [...bytes].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
};

export default async function(req: Request) {
  if (req.method !== 'POST') return Response.json({ error: 'POST required.' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    if (!canIssueReferralCard(guard.user)) return Response.json({ error: 'Referral sharing unlocks after your referred account has an active, verified paid subscription.' }, { status: 403 });
    const input = await req.json().catch(() => ({}));
    const label = String(input.card_label || '').trim().slice(0, 80);
    const sr = base44.asServiceRole;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const code = newCode();
      const alreadyExists = await sr.entities.ReferralCard.filter({ code });
      if (alreadyExists?.length) continue;
      const record = await sr.entities.ReferralCard.create({
        code, status: 'available', issued_by_user_id: guard.user.id,
        issued_at: new Date().toISOString(), reward_tier: REFERRAL_REWARD_TIER,
        reward_days: REFERRAL_REWARD_DAYS, card_label: label,
        ...(guard.user.role !== 'admin' ? { parent_referral_code: guard.user.referral_reward_code } : {}),
      });
      await sr.entities.AuditLog.create({
        action: 'referral_card_issued', actor_user_id: guard.user.id,
        target_type: 'referral_card', target_id: record.id,
        status: 'success', detail: 'One 30-day full-access referral card issued.',
      }).catch(() => null);
      return Response.json({
        ok: true, card_id: record.id, code, reward_tier: REFERRAL_REWARD_TIER, reward_days: REFERRAL_REWARD_DAYS,
        url: canonicalOrigin + '/?ref=' + encodeURIComponent(code),
      }, { headers: { 'Cache-Control': 'no-store' } });
    }
    return Response.json({ error: 'Could not generate a unique code.' }, { status: 503 });
  } catch (error) {
    console.error('issueReferralCard:', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ error: 'Could not issue the card.' }, { status: 503 });
  }
}
