import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { stripeCryptoGatewayReadiness } from '../../shared/stripeCryptoReadiness.ts';
import { isFeatureEnabled } from '../../shared/featureFlagGate.ts';
import { isPublicCampaignFundraisingEnabled } from '../../shared/fundraisingMode.ts';

// Public-safe and provider-backed; no customer wallet information is returned.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const [provider, flag, fundraising] = await Promise.all([
      stripeCryptoGatewayReadiness(),
      isFeatureEnabled(base44, 'crypto_donations'),
      isPublicCampaignFundraisingEnabled(base44),
    ]);
    const checkoutAvailable = provider.ready && flag && fundraising;
    return Response.json({
      crypto: {
        wallet_provider: 'reown_appkit',
        settlement_provider: 'stripe',
        settlement_currency: 'USD',
        gateway_approved: provider.approved,
        webhook_verified: provider.webhook_ready,
        configured: provider.account_ready,
        verified_checkout_live: checkoutAvailable,
        settlement_ready: checkoutAvailable,
        status: checkoutAvailable ? 'provider_ready' : 'awaiting_verified_settlement_gateway',
        reason: !fundraising ? 'Campaign donations are currently paused.'
          : !flag ? 'Crypto donations have not been enabled by IFund.'
          : provider.reason,
      }
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('getCryptoDonationReadiness:', error?.name || 'UnknownError');
    return Response.json({
      crypto: { wallet_provider: 'reown_appkit', settlement_provider: 'stripe',
        verified_checkout_live: false, settlement_ready: false,
        status: 'verification_unavailable', reason: 'Crypto payment readiness could not be verified.' }
    }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
