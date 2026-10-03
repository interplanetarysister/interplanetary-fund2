import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logAudit } from '../../shared/auditLog.ts';
import { hasImplementedTransferAdapter, resolveCapabilityMap } from '../../shared/providerCapabilities.ts';
import { evaluateCollectionSource, WITHDRAWAL_FEE_RATE, WITHDRAWAL_FEE_VERSION } from '../../shared/externalFundPolicy.js';

const AUTH_VERSION = '2026-10-collect-withdraw-v1';
const ttlMs = 15 * 60 * 1000;
const operationId = () => crypto.randomUUID();

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const campaignId = String(body.campaign_id || '');
    const sr = base44.asServiceRole;
    const campaign = campaignId ? await sr.entities.Campaign.get(campaignId).catch(() => null) : null;
    if (campaignId && (!campaign || campaign.created_by_id !== user.id)) return Response.json({ error: 'Campaign not found.' }, { status: 404 });
    const ownedCampaigns = campaign ? [campaign] : await sr.entities.Campaign.filter({ created_by_id: user.id }, '-created_date', 200).catch(() => []);
    const campaignIds = new Set(ownedCampaigns.map((c) => c.id));
    const allConnections = await sr.entities.PlatformConnection.filter({ created_by_id: user.id, kind: 'crowdfunding' }, '-updated_date', 300).catch(() => []);
    const connections = allConnections.filter((c) => campaign ? c.campaign_id === campaign.id : (!c.campaign_id || campaignIds.has(c.campaign_id)));
    const byPlatform = await resolveCapabilityMap(sr);
    const payoutAccounts = await sr.entities.ConnectedPayoutAccount.filter({ owner_user_id: user.id, provider: 'stripe_connect' }, '-updated_date', 5).catch(() => []);
    const payoutAccount = payoutAccounts[0] || null;
    const payoutVerifiedAt = new Date(payoutAccount?.last_verified_at || 0).getTime();
    const payoutReady = payoutAccount?.status === 'ready' && payoutAccount?.payouts_enabled === true &&
      Number.isFinite(payoutVerifiedAt) && Date.now() - payoutVerifiedAt <= 24 * 60 * 60 * 1000;
    const sources = connections.map((connection) => {
      const cap = byPlatform.get(String(connection.platform).toLowerCase());
      const payoutModel = cap?.payout_model || 'observe_only';
      // Observation freshness: never represent stale owner-reported balances as
      // freshly verified. The owner sees when the balance was last observed and
      // whether it is provider-verified or owner-reported provenance.
      const dataSource = connection.external_data_source || 'owner_reported';
      const policy = evaluateCollectionSource({ connection, adapterAvailable: hasImplementedTransferAdapter(cap), payoutReady });
      const { amount, currency, observedAt, stale, currencyValid, technicallyEligible, eligible, estimatedPlatformFee, estimatedNet } = policy;
      return {
        connection_id: connection.id, campaign_id: connection.campaign_id || '', platform: connection.platform, amount, currency,
        payout_model: payoutModel, status: eligible ? 'ready_for_authorization' : 'user_action_required',
        observed_at: observedAt, data_source: dataSource, observation_stale: stale,
        platform_fee_rate: WITHDRAWAL_FEE_RATE, estimated_platform_fee: estimatedPlatformFee,
        estimated_net_after_platform_fee: estimatedNet,
        note: eligible ? '' : (!currencyValid ? 'Provider currency is unavailable or invalid.' : dataSource !== 'provider_verified' ? 'This balance is informational because it is not provider-verified.' : stale ? 'Refresh this provider balance before collection.' : !payoutReady && technicallyEligible ? 'Finish or refresh your IFund payout account setup before this source can be consolidated.' : !hasImplementedTransferAdapter(cap) ? 'No current provider-specific transfer adapter is verified for collection.' : 'Provider payout capability still requires verification.'),
      };
    });

    const now = Date.now();
    const operation_id = operationId();
    const authorization = await sr.entities.ExternalCollectionAuthorization.create({
      owner_user_id: user.id, campaign_id: campaign?.id || '', operation_id,
      status: 'prepared', expires_at: new Date(now + ttlMs).toISOString(),
      sources, destination_type: 'ifund_connected_account',
      destination_ref: payoutReady ? payoutAccount.provider_account_id : '',
      authorization_text_version: AUTH_VERSION,
      consent_snapshot: JSON.stringify({ campaign_id: campaign?.id || '', scope: campaign ? 'campaign' : 'all_owned_campaigns', fee_version: WITHDRAWAL_FEE_VERSION, platform_fee_rate: WITHDRAWAL_FEE_RATE, destination_ref: payoutReady ? payoutAccount.provider_account_id : '', sources: sources.map(({connection_id,campaign_id,platform,amount,currency,payout_model,observed_at,data_source,observation_stale,estimated_platform_fee,estimated_net_after_platform_fee}) => ({connection_id,campaign_id,platform,amount,currency,payout_model,observed_at,data_source,observation_stale,estimated_platform_fee,estimated_net_after_platform_fee})) }),
    });
    await logAudit(base44, { action: 'collect_withdraw_prepared', actor_user_id: user.id, target_type: 'ExternalCollectionAuthorization', target_id: authorization.id, detail: 'Prepared external collection authorization; no money moved.', status: 'success', metadata: { operation_id, campaign_id: campaign?.id || '', scope: campaign ? 'campaign' : 'all_owned_campaigns', source_count: sources.length } });
    return Response.json({ ok: true, authorization_id: authorization.id, operation_id, expires_at: authorization.expires_at, payout_account_ready: payoutReady, sources,
      fee_version: WITHDRAWAL_FEE_VERSION, platform_fee_rate: WITHDRAWAL_FEE_RATE,
      confirmation: 'Allow Interplanetary Fund to initiate only the verified provider transfers listed here? The established 3% platform fee applies when transferred funds are withdrawn from Interplanetary Fund; provider and processor fees may also apply.' });
  } catch (error) {
    console.error('prepareCollectAndWithdraw failed:', error?.message || error);
    return Response.json({ error: 'Could not prepare connected-platform collection.' }, { status: 500 });
  }
}
