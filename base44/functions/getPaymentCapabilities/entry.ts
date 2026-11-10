import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { IFUND_PAYPAL_ACCOUNT_REF, IFUND_PAYPAL_ACCOUNT_TYPE, isLivePayPalRestReady, isLivePayPalPayoutReady } from '../../shared/paypal.ts';
import {
  resolvePayPalEnvironment, paypalCredentials, isPayPalSandboxDemoEnabled, paypalSandboxCredentialsPresent,
} from '../../shared/paypalEnvironment.ts';

// Public-safe payment capability snapshot. UI must use this instead of
// inferring provider availability from rendered components or repository code.
// Sandbox demo checkout is reported separately from live campaign payments so a
// paused live policy never hides the test path, and test money is clearly labeled.
export default async function (_req) {
  const base44 = createClientFromRequest(_req);
  const environment = resolvePayPalEnvironment();
  const isSandbox = environment === 'sandbox';
  const sandboxCredentials = paypalSandboxCredentialsPresent();
  const demoEnabled = await isPayPalSandboxDemoEnabled(base44.asServiceRole);
  const sandboxReady = isSandbox && sandboxCredentials && demoEnabled;

  const { clientId, clientSecret } = paypalCredentials(environment);
  const paypalConfigured = Boolean(clientId && clientSecret);
  const paypalApiLive = Boolean(paypalConfigured && !isSandbox && await isLivePayPalRestReady());
  const paypalPayoutLive = paypalApiLive && await isLivePayPalPayoutReady();
  const sandboxClientId = sandboxReady ? paypalCredentials('sandbox').clientId : '';

  return Response.json({
    paypal: {
      // The canonical paypal.com donation-link path is independently available
      // and does not require REST API credentials. Do not conflate it with SDK/API checkout.
      donation_link_available: true,
      api_configured: paypalConfigured,
      api_live: paypalApiLive,
      payout_api_live: paypalPayoutLive,
      mode: environment,
      account_ref: IFUND_PAYPAL_ACCOUNT_REF,
      account_type: IFUND_PAYPAL_ACCOUNT_TYPE,
      sandbox: {
        ready: sandboxReady,
        credentials_configured: sandboxCredentials,
        demo_enabled: demoEnabled,
        client_id: sandboxClientId,
        currency: 'USD',
        // Why the demo path is closed, for an honest disabled state.
        disabled_reason: sandboxReady ? ''
          : !sandboxCredentials ? 'Sandbox PayPal credentials are not configured.'
          : 'Sandbox demo checkout is not enabled by an administrator.',
      },
    },
  });
}