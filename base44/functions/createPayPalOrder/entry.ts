import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createOrder } from '../../shared/paypal.ts';
import { checkRateLimit } from '../../shared/rateLimit.ts';
import { assertActiveAccountIfSignedIn } from '../../shared/accountGuard.ts';
import { validateDonationAmount, computeProcessingFee, computeContribution, round2 } from '../../shared/fees.js';
import { ensureCanonicalCampaign } from '../../shared/convexFinancial.ts';

// Creates a PayPal v2 order for a Google Pay donation. All financially
// meaningful values are encoded server-side into PayPal custom_id so capture
// can verify campaign, donation amount, processor fee, and optional platform
// contribution without trusting post-payment client input.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    const donorGuard = await assertActiveAccountIfSignedIn(base44);
    if (!donorGuard.ok) return Response.json({ error: donorGuard.error }, { status: donorGuard.status });

    const { campaign_id, amount, platform_contribution } = await req.json();
    const amountCheck = validateDonationAmount(amount);
    if (!amountCheck.ok) return Response.json({ error: amountCheck.error }, { status: 400 });
    if (!campaign_id) return Response.json({ error: 'A campaign is required' }, { status: 400 });
    const value = Number(amount);

    const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anon').split(',')[0].trim();
    const rl = await checkRateLimit(base44, `createPayPalOrder:${ip}`, 10, 60);
    if (!rl.allowed) {
      return Response.json({ error: 'Too many attempts. Please slow down and try again.' }, { status: 429 });
    }

    const campaign = await sr.entities.Campaign.get(campaign_id).catch(() => null);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status !== 'active') return Response.json({ error: 'This campaign is not accepting donations.' }, { status: 400 });

    await ensureCanonicalCampaign(sr, campaign);

    const processing = computeProcessingFee(value);
    const contribution = computeContribution(value, !!platform_contribution);
    const totalCharge = round2(value + processing);
    const order = await createOrder({
      amount: totalCharge,
      description: `Donation to ${campaign.title}`,
      customId: [
        campaign_id,
        Math.round(value * 100),
        Math.round(processing * 100),
        Math.round(contribution * 100),
      ].join('|'),
    });

    return Response.json({ id: order.id });
  } catch (error) {
    console.error('createPayPalOrder error:', error?.message || error);
    return Response.json({ error: 'Unable to start your donation. Please try again.' }, { status: 503 });
  }
}
