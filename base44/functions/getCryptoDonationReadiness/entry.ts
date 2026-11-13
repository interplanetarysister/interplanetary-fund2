import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { stripeCryptoGatewayReadiness } from '../../shared/stripeCryptoReadiness.ts';
import { isFeatureEnabled } from '../../shared/featureFlagGate.ts';

// Public-safe crypto donation status. It probes the provider itself instead of
// trusting a toggle: crypto only becomes available when Stripe reports the
// merchant's crypto method approved, the live account verified and the live
// settlement webhook registered.
export default async function (req: Request) {
  const base44 = createClientFromRequest(req);
  const [enabled, readiness] = await Promise.all([
    isFeatureEnabled(base44, 'crypto_donations'),
    stripeCryptoGatewayReadiness().catch(() => ({
      approved: false, account_ready: false, webhook_ready: false, ready: false,
    })),
  ]);
  const available = enabled === true && readiness.ready === true;

  return Response.json({
    crypto: {
      provider: 'stripe',
      enabled: enabled === true,
      approved: readiness.approved === true,
      account_ready: readiness.account_ready === true,
      webhook_ready: readiness.webhook_ready === true,
      available,
      status: available ? 'ready' : enabled !== true ? 'turned_off' : 'awaiting_provider_setup',
      reason: available
        ? ''
        : enabled !== true
          ? 'Cryptocurrency donations are turned off for the platform.'
          : 'Crypto donations are awaiting verified payment provider approval, so no gift can be accepted yet.',
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}