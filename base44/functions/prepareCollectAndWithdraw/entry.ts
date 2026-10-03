import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hasUnifiedOboConsent } from '../../shared/integrationRegistry.ts';
import { logAudit } from '../../shared/auditLog.ts';

const AUTH_VERSION = '2026-10-collect-withdraw-v1';
const ttlMs = 15 * 60 * 1000;
const operationId = () => crypto.randomUUID();

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasUnifiedOboConsent(user)) return Response.json({ error: 'AI/OBO authorization is required before connected-platform collection can be prepared.' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const campaignId = String(body.campaign_id || '');
    const campaign = campaignId ? await base44.entities.Campaign.get(campaignId).catch(() => null) : null;
    if (!campaign || campaign.created_by_id !== user.id) return Response.json({ error: 'Campaign not found.' }, { status: 404 });

    const sr = base44.asServiceRole;
    const connections = await sr.entities.PlatformConnection.filter({ created_by_id: user.id, campaign_id: campaign.id, kind: 'crowdfunding' }, '-updated_date', 100).catch(() => []);
    const capabilities = await sr.entities.FundraisingProviderCapability.list('-updated_date', 500).catch(() => []);
    const payoutAccounts = await sr.entities.ConnectedPayoutAccount.filter({ owner_user_id: user.id, provider: 'stripe_connect' }, '-updated_date', 5).catch(() => []);
    const payoutAccount = payoutAccounts[0] || null;
    const payoutReady = payoutAccount?.status === 'ready' && payoutAccount?.payouts_enabled === true;
    const byPlatform = new Map((capabilities || []).map((c) => [String(c.platform).toLowerCase(), c]));
    const sources = connections.map((connection) => {
      const cap = byPlatform.get(String(connection.platform).toLowerCase());
      const currency = String(connection.external_currency || 'USD').toUpperCase();
      const amount = Number(connection.external_total || 0);
      const payoutModel = cap?.payout_model || 'observe_only';
      const technicallyEligible = connection.status === 'connected' && connection.verification_status === 'verified' &&
        amount > 0 && !['observe_only','user_action_required'].includes(payoutModel);
      const eligible = technicallyEligible && payoutReady;
      return {
        connection_id: connection.id, platform: connection.platform, amount, currency,
        payout_model: payoutModel, status: eligible ? 'ready_for_authorization' : 'user_action_required',
        note: eligible ? '' : (!payoutReady && technicallyEligible ? 'Finish your IFund payout account setup before this source can be consolidated.' : (cap ? 'This provider cannot currently be collected automatically from this connection.' : 'Provider payout capability still requires verification.')),
      };
    });

    const now = Date.now();
    const operation_id = operationId();
    const authorization = await sr.entities.ExternalCollectionAuthorization.create({
      owner_user_id: user.id, campaign_id: campaign.id, operation_id,
      status: 'prepared', expires_at: new Date(now + ttlMs).toISOString(),
      sources, destination_type: 'ifund_connected_account',
      authorization_text_version: AUTH_VERSION,
      consent_snapshot: JSON.stringify({ campaign_id: campaign.id, sources: sources.map(({connection_id,platform,amount,currency,payout_model}) => ({connection_id,platform,amount,currency,payout_model})) }),
    });
    await logAudit(base44, { action: 'collect_withdraw_prepared', actor_user_id: user.id, target_type: 'ExternalCollectionAuthorization', target_id: authorization.id, detail: 'Prepared external collection authorization; no money moved.', status: 'success', metadata: { operation_id, campaign_id: campaign.id, source_count: sources.length } });
    return Response.json({ ok: true, authorization_id: authorization.id, operation_id, expires_at: authorization.expires_at, payout_account_ready: payoutReady, sources,
      confirmation: 'Allow Interplanetary Fund to initiate withdrawal of available funds from the connected platforms listed here and combine successfully transferred funds into this withdrawal?' });
  } catch (error) {
    console.error('prepareCollectAndWithdraw failed:', error?.message || error);
    return Response.json({ error: 'Could not prepare connected-platform collection.' }, { status: 500 });
  }
}