import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createOrder } from '../../shared/paypal.ts';
import { checkRateLimit } from '../../shared/rateLimit.ts';
import { assertActiveAccountIfSignedIn } from '../../shared/accountGuard.ts';
import { validateDonationAmount, computeProcessingFee, round2 } from '../../shared/fees.js';

// Creates a PayPal v2 order (intent: CAPTURE) for a Google Pay donation. The
// order id is handed to the PayPal SDK's Google Pay session to confirm with
// the buyer's Google Pay payment data, then captured separately.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    // A signed-in revoked account must not initiate a donation. Unsigned donors
    // (Google Pay) remain allowed.
    const donorGuard = await assertActiveAccountIfSignedIn(base44);
    if (!donorGuard.ok) return Response.json({ error: donorGuard.error }, { status: donorGuard.status });

    const { campaign_id, amount, donor_name, message } = await req.json();
    const amountCheck = validateDonationAmount(amount);
    if (!amountCheck.ok) return Response.json({ error: amountCheck.error }, { status: 400 });
    if (!campaign_id) {
      return Response.json({ error: 'A campaign is required' }, { status: 400 });
    }
    const value = Number(amount);

    // Narrow abuse guard on order creation only — generous enough that a
    // legitimate donor never hits it, but stops a script spamming orders. By
    // IP: Google Pay donors may not be signed in, so there is no user id to key
    // on. Successful captures are never rate-limited.
    const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anon').split(',')[0].trim();
    const rl = await checkRateLimit(base44, `createPayPalOrder:${ip}`, 10, 60);
    if (!rl.allowed) {
      return Response.json({ error: 'Too many attempts. Please slow down and try again.' }, { status: 429 });
    }

    const campaign = await sr.entities.Campaign.get(campaign_id).catch(() => null);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

    // Processor fee passed through to the donor (Google Pay / PayPal order).
    // The donation (value) and the fee are encoded in custom_id, set server-side,
    // so capture records the authoritative donation amount — never a client total.
    const processing = computeProcessingFee(value);
    const totalCharge = round2(value + processing);
    const order = await createOrder({
      amount: totalCharge,
      description: `Donation to ${campaign.title}`,
      customId: `${campaign_id}|${Math.round(value * 100)}|${Math.round(processing * 100)}`,
    });

    return Response.json({ id: order.id });
  } catch (error) {
    console.error('createPayPalOrder error:', error.message);
    return Response.json({ error: 'Unable to start your donation. Please try again.' }, { status: 500 });
  }
}