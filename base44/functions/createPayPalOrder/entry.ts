import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { createOrder } from '../../shared/paypal.ts';
import {
  resolvePayPalEnvironment, isPayPalSandboxDemoEnabled, paypalCredentials,
  paypalMerchantEmail, paypalSandboxCredentialsPresent,
} from '../../shared/paypalEnvironment.ts';
import { checkRateLimit } from '../../shared/rateLimit.ts';
import { assertActiveAccountIfSignedIn } from '../../shared/accountGuard.ts';
import { validateDonationAmount, computePayPalBreakdown, round2 } from '../../shared/fees.js';
import { ensureCanonicalCampaign } from '../../shared/base44Financial.ts';
import { campaignPaymentAccess } from '../../shared/prelaunchPayments.ts';
import { areFeaturesEnabled, featureUnavailable } from '../../shared/featureFlagGate.ts';

// Creates an idempotent PayPal Orders v2 order (intent CAPTURE).
//
// Live campaign checkout stays behind the paused fundraising policy. Sandbox
// demo checkout is a separate, administrator-gated path so fake-money testing
// is never blocked by that policy. Every financially meaningful value is
// validated and persisted server-side BEFORE the provider order exists, and is
// encoded into PayPal custom_id so capture can verify it against PayPal.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const environment = resolvePayPalEnvironment();

    if (environment === 'sandbox') {
      if (!paypalSandboxCredentialsPresent()) {
        return Response.json({ error: 'Sandbox PayPal credentials are not configured. Nothing was started.' }, { status: 503 });
      }
      if (!(await isPayPalSandboxDemoEnabled(sr))) {
        return Response.json({ error: 'Sandbox demo checkout is not enabled for this app. Nothing was started.' }, { status: 409 });
      }
    } else {
      const paymentAccess = await campaignPaymentAccess(base44);
      if (!paymentAccess.allowed) return Response.json({ error: 'Campaign donations are currently paused. The platform remains open for campaigns and sharing.' }, { status: 409 });
      if (secrets.get('PAYPAL_MODE') !== 'live') return Response.json({ error: 'PayPal campaign payments are not currently available.' }, { status: 503 });
      const { clientId, clientSecret } = paypalCredentials('live');
      if (!clientId || !clientSecret) return Response.json({ error: 'PayPal campaign payments are not currently available.' }, { status: 503 });
    }

    const donorGuard = await assertActiveAccountIfSignedIn(base44);
    if (!donorGuard.ok) return Response.json({ error: donorGuard.error }, { status: donorGuard.status });

    const { campaign_id, amount, platform_contribution, intent_id, payment_channel } = await req.json();
    const amountCheck = validateDonationAmount(amount);
    if (!amountCheck.ok) return Response.json({ error: amountCheck.error }, { status: 400 });
    if (!campaign_id) return Response.json({ error: 'A campaign is required' }, { status: 400 });
    if (!intent_id || !/^[A-Za-z0-9_-]{16,100}$/.test(String(intent_id))) return Response.json({ error: 'A stable payment intent is required' }, { status: 400 });
    const channel = ['paypal', 'googlepay', 'applepay'].includes(payment_channel) ? payment_channel : '';
    if (!channel) return Response.json({ error: 'A supported payment channel is required' }, { status: 400 });
    if (environment === 'live' && !(await areFeaturesEnabled(base44, ['payment_checkout_enabled', channel === 'googlepay' ? 'google_pay_checkout' : channel === 'applepay' ? 'apple_pay_checkout' : 'paypal_checkout']))) return featureUnavailable('This payment method');

    const quote = computePayPalBreakdown(Number(amount), platform_contribution === true, channel);
    const totalCharge = quote.totalCharged;
    if (!(totalCharge > 0) || totalCharge > 1000000) return Response.json({ error: 'The total payment amount is too large.' }, { status: 400 });

    const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anon').split(',')[0].trim();
    const rl = await checkRateLimit(base44, `createPayPalOrder:${ip}`, 10, 60);
    if (!rl.allowed) {
      return Response.json({ error: 'Too many attempts. Please slow down and try again.' }, { status: 429 });
    }

    const campaign = await sr.entities.Campaign.get(campaign_id).catch(() => null);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status !== 'active') return Response.json({ error: 'This campaign is not accepting donations.' }, { status: 400 });

    await ensureCanonicalCampaign(sr, campaign);

    const processing = quote.processing;
    const value = quote.amount; // promised campaign gift + optional platform contribution
    const contribution = quote.contribution;
    if (!(value > 0) || !(round2(value - contribution) > 0)) {
      return Response.json({ error: 'The campaign gift must remain positive.' }, { status: 400 });
    }

    // Idempotent checkout intent: an environment-scoped request key is the
    // durable uniqueness boundary for order creation retries.
    const requestKey = `${environment}:${String(intent_id)}`;
    const priorRows = await sr.entities.PayPalOrder.filter({ request_key: requestKey }).catch(() => []);
    if (!Array.isArray(priorRows)) return Response.json({ error: 'Unable to verify this checkout safely.' }, { status: 503 });
    if (priorRows.length > 1) return Response.json({ error: 'This checkout requires reconciliation.' }, { status: 409 });
    const prior = priorRows[0] || null;
    if (prior) {
      if (prior.campaign_id !== campaign_id || String(prior.environment) !== environment ||
          Math.abs(round2(prior.total_charge) - round2(totalCharge)) > 0.01) {
        return Response.json({ error: 'This checkout intent does not match the saved donation.' }, { status: 409 });
      }
      if (prior.order_id && ['created', 'approved', 'pending'].includes(prior.state)) {
        return Response.json({ id: prior.order_id, environment, test_mode: environment === 'sandbox', reused: true });
      }
      if (prior.state === 'captured') {
        return Response.json({ id: prior.order_id, environment, test_mode: environment === 'sandbox', already_captured: true });
      }
      const age = Date.now() - new Date(prior.created_at || prior.created_date || 0).getTime();
      if (prior.state === 'creating' && age < 2 * 60 * 1000) {
        return Response.json({ error: 'This checkout is already being prepared. Please wait a moment and try again.' }, { status: 409 });
      }
    }

    const merchantEmail = paypalMerchantEmail(environment);
    const customId = [
      campaign_id,
      Math.round(value * 100),
      Math.round(processing * 100),
      Math.round(contribution * 100),
      channel,
      'gift_first_v2',
    ].join('|');

    // Persist the validated amount before the provider order exists so capture
    // can compare PayPal's answer with what this app intended to charge.
    const savedRow = await sr.entities.PayPalOrder.upsert([{
      request_key: requestKey,
      environment,
      campaign_id,
      campaign_title: campaign.title || 'Campaign',
      validated_gift: round2(value - contribution),
      platform_contribution: round2(contribution),
      processing_fee: round2(processing),
      total_charge: round2(totalCharge),
      currency: 'USD',
      payment_channel: channel,
      merchant_email: merchantEmail || '',
      state: 'creating',
      order_id: prior?.order_id || '',
      custom_id: customId,
      donor_user_id: donorGuard.donor?.id || '',
      donor_name: donorGuard.donor?.full_name || '',
      created_at: new Date().toISOString(),
      last_error: '',
    }], { key: 'request_key' });

    let order;
    try {
      order = await createOrder({
        amount: totalCharge,
        description: `Donation to ${campaign.title}`,
        customId,
        requestId: String(intent_id),
        environment,
      });
    } catch (error) {
      await sr.entities.PayPalOrder.upsert([{
        request_key: requestKey, environment, campaign_id, campaign_title: campaign.title || 'Campaign',
        validated_gift: round2(value - contribution), platform_contribution: round2(contribution),
        processing_fee: round2(processing), total_charge: round2(totalCharge), currency: 'USD',
        payment_channel: channel, merchant_email: merchantEmail || '', state: 'failed',
        order_id: '', custom_id: customId, donor_user_id: donorGuard.donor?.id || '',
        created_at: new Date().toISOString(), last_error: 'order_create_failed',
      }], { key: 'request_key' });
      throw error;
    }

    const existingOrders = await sr.entities.PayPalOrder.filter({ order_id: order.id }).catch(() => []);
    if (Array.isArray(existingOrders) && existingOrders.some((row) => row.request_key !== requestKey)) {
      return Response.json({ error: 'PayPal returned an order already bound to another checkout.' }, { status: 409 });
    }

    // Do not return an order to the browser unless we can subsequently
    // authenticate it against exactly one durable, matching server-side row.
    // An approved PayPal order with no persisted mapping cannot be safely
    // captured or reconciled against campaign finances.
    const matchingRows = await sr.entities.PayPalOrder.filter({ request_key: requestKey });
    if (!Array.isArray(matchingRows) || matchingRows.length !== 1 ||
        matchingRows[0].environment !== environment ||
        matchingRows[0].campaign_id !== campaign_id ||
        Math.abs(round2(matchingRows[0].total_charge) - round2(totalCharge)) > 0.01) {
      return Response.json({ error: 'Payment order could not be safely recorded. Nothing was charged.' }, { status: 503 });
    }
    await sr.entities.PayPalOrder.update(matchingRows[0].id, {
      order_id: order.id,
      state: 'created',
      last_error: '',
    });
    const confirmedRows = await sr.entities.PayPalOrder.filter({ request_key: requestKey });
    if (!Array.isArray(confirmedRows) || confirmedRows.length !== 1 ||
        confirmedRows[0].order_id !== order.id ||
        confirmedRows[0].state !== 'created') {
      return Response.json({ error: 'Payment order could not be verified. Nothing was charged.' }, { status: 503 });
    }

    return Response.json({
      id: order.id,
      environment,
      test_mode: environment === 'sandbox',
      merchant_configured: Boolean(merchantEmail),
    });
  } catch (error) {
    console.error('createPayPalOrder error:', error?.message || error);
    return Response.json({ error: 'Unable to start your donation. Please try again.' }, { status: 503 });
  }
}