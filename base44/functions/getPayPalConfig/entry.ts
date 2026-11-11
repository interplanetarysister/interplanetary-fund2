import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { campaignPaymentAccess } from '../../shared/prelaunchPayments.ts';
import { areFeaturesEnabled } from '../../shared/featureFlagGate.ts';
import { IFUND_PAYPAL_ACCOUNT_REF, IFUND_PAYPAL_ACCOUNT_TYPE, isLivePayPalRestReady } from '../../shared/paypal.ts';
import { resolveVerifiedCampaignWebhookId } from '../../shared/paypalCampaignReadiness.ts';
import { resolvePayPalEnvironment, paypalCredentials } from '../../shared/paypalEnvironment.ts';

// Public-safe PayPal SDK configuration. Only the browser-publishable client ID
// is ever returned; the client secret, webhook id and merchant credentials are
// server-only. Nothing here proves the credential works — readiness does.
export default async function (req) {
  const environment = resolvePayPalEnvironment();
  const { clientId, clientSecret } = paypalCredentials(environment);
  const configured = Boolean(clientId && clientSecret);
  const isSandbox = environment === 'sandbox';
  const oauthReady = configured && !isSandbox ? await isLivePayPalRestReady() : false;
  let webhookReady = false;
  if (oauthReady) {
    try {
      const checkClient = createClientFromRequest(req);
      webhookReady = Boolean(await resolveVerifiedCampaignWebhookId(checkClient.asServiceRole, 'live'));
    } catch { webhookReady = false; }
  }
  const providerReady = oauthReady && webhookReady;
  let checkoutReady = false;
  if (providerReady && !isSandbox) {
    try {
      const base44 = createClientFromRequest(req);
      const [access, flags] = await Promise.all([
        campaignPaymentAccess(base44),
        areFeaturesEnabled(base44, ['payment_checkout_enabled','paypal_checkout']),
      ]);
      checkoutReady = access.allowed === true && flags === true;
    } catch { checkoutReady = false; }
  }
  // A functioning PayPal application is not the same as accepting donations.
  const liveReady = providerReady && checkoutReady;

  return Response.json({
    provider: 'paypal',
    environment,
    mode: environment,
    test_mode: isSandbox,
    configured,
    api_configured: configured,
    live: liveReady,
    api_live: oauthReady,
    provider_ready: providerReady,
    checkout_enabled: checkoutReady,
    webhook_ready: webhookReady,
    client_id: configured && (isSandbox || liveReady) ? clientId : null,
    currency: 'USD',
    donation_link_available: true,
    account_ref: IFUND_PAYPAL_ACCOUNT_REF,
    account_type: IFUND_PAYPAL_ACCOUNT_TYPE,
  });
}