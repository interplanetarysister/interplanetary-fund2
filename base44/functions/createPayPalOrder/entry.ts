import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createOrder } from '../../shared/paypal.ts';

// Creates a PayPal v2 order (intent: CAPTURE) for a Google Pay donation. The
// PayPal order's custom_id becomes the authoritative campaign binding used by
// the capture path; caller-supplied amount is validated before creating it.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    const { campaign_id, amount, donor_name, message } = await req.json();
    const value = Number(amount);
    if (!campaign_id || !Number.isFinite(value) || value <= 0 || value > 1000000) {
      return Response.json({ error: 'A campaign and a valid positive amount are required' }, { status: 400 });
    }

    const campaign = await sr.entities.Campaign.get(campaign_id);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

    const order = await createOrder({
      amount: Math.round(value * 100) / 100,
      description: `Donation to ${campaign.title}`,
      metadata: {
        campaign_id,
        donor_name: donor_name || 'Anonymous',
        message: (message || '').slice(0, 250),
      },
    });

    return Response.json({ id: order.id });
  } catch (error) {
    console.error('createPayPalOrder error:', error);
    return Response.json({ error: 'Unable to start the PayPal donation. Please try again.' }, { status: 500 });
  }
}