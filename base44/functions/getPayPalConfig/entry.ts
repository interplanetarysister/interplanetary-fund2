import { IFUND_PAYPAL_ACCOUNT_REF, IFUND_PAYPAL_ACCOUNT_TYPE, isLivePayPalRestReady } from '../../shared/paypal.ts';
import { resolvePayPalEnvironment, paypalCredentials } from '../../shared/paypalEnvironment.ts';

// Public-safe PayPal SDK configuration. Only the browser-publishable client ID
// is ever returned; the client secret, webhook id and merchant credentials are
// server-only. Nothing here proves the credential works — readiness does.
export default async function (_req) {
  const environment = resolvePayPalEnvironment();
  const { clientId, clientSecret } = paypalCredentials(environment);
  const configured = Boolean(clientId && clientSecret);
  const isSandbox = environment === 'sandbox';
  const liveReady = configured && !isSandbox ? await isLivePayPalRestReady() : false;

  return Response.json({
    provider: 'paypal',
    environment,
    mode: environment,
    test_mode: isSandbox,
    configured,
    api_configured: configured,
    live: liveReady,
    api_live: liveReady,
    client_id: configured && (isSandbox || liveReady) ? clientId : null,
    currency: 'USD',
    donation_link_available: true,
    account_ref: IFUND_PAYPAL_ACCOUNT_REF,
    account_type: IFUND_PAYPAL_ACCOUNT_TYPE,
  });
}