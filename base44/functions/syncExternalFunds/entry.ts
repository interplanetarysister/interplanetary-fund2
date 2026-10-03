import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logAudit } from '../../shared/auditLog.ts';
import { ensureCanonicalCampaign, recordCanonicalExternalObservation } from '../../shared/base44Financial.ts';

// Centralized external-fund synchronization engine used by scheduled sync,
// Count My Money, Sync Linked Platforms, and Migrate Funds discovery.
//
// IMPORTANT FINANCIAL BOUNDARY:
// Provider APIs/webhooks usually prove that a donation exists on an EXTERNAL
// account; they do not prove that Interplanetary Fund possesses those funds.
// Therefore discovered transactions are canonical external observations only.
// They never create Donation rows, campaignLedger credits, or IF-withdrawable
// value. A separate verified transfer/migration operation is required before
// external money may enter the canonical IF ledger.
//
// Guarantees:
// - Base44 FinancialOperation identity is the authoritative dedupe boundary.
// - retries repair absolute observed totals; no Base44 financial $inc.
// - currencies are never combined without an explicit conversion.
// - per-provider failures remain isolated and auditable.

const num = (v) => (typeof v === 'number' ? v : Number(v) || 0);
const validCurrency = (v) => /^[A-Z]{3}$/.test(String(v || '').trim().toUpperCase());

// Per-platform adapter. Returns { status, amount_discovered, transactions, note }.
// A transaction intended for import MUST include stable id, amount, and currency.
async function adapterFor(connection) {
  const p = connection.platform;
  if (p === 'kofi') {
    return {
      status: 'realtime_webhook',
      amount_discovered: 0,
      transactions: [],
      note: 'Ko-fi payments synchronize in real time through the canonical webhook observation path; no pull API is used.',
    };
  }
  if (p === 'buymeacoffee' || p === 'patreon') {
    return {
      status: 'credentials_required',
      amount_discovered: 0,
      transactions: [],
      note: `${p} transaction discovery requires a valid per-connection access token. Existing owner-reported totals remain informational only.`,
    };
  }
  return {
    status: 'no_read_api',
    amount_discovered: 0,
    transactions: [],
    note: `${p} has no configured authoritative read adapter. Existing external totals are informational only.`,
  };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized. Scheduled synchronization requires a trusted authenticated invocation.' }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const requestedScope = body.scope || 'user';
    if (!['user', 'all'].includes(requestedScope)) {
      return Response.json({ error: 'scope must be "user" or "all".' }, { status: 400 });
    }
    const scope = user.role === 'admin' ? requestedScope : 'user';
    const oboUserId = user.role === 'admin' ? (body.obo_user_id || null) : null;
    const initiatorType = user.role === 'admin' && body.initiator_type === 'scheduled' ? 'scheduled' : 'user';
    const targetUserId = oboUserId || (scope === 'user' ? user.id : null);
    const startedAt = new Date().toISOString();
    const providerResults = [];
    const discoveredByCurrency = new Map();
    let totalImported = 0;
    let campaignsCovered = 0;

    let campaigns = [];
    if (body.campaign_id) {
      const c = await sr.entities.Campaign.get(body.campaign_id).catch(() => null);
      if (!c) return Response.json({ error: 'Campaign not found.' }, { status: 404 });
      if (user.role !== 'admin' && c.created_by_id !== user.id) {
        return Response.json({ error: 'You can only synchronize your own campaigns.' }, { status: 403 });
      }
      campaigns = [c];
    } else if (scope === 'user' && targetUserId) {
      campaigns = await sr.entities.Campaign.filter({ created_by_id: targetUserId }, '-created_date', 100);
    } else {
      campaigns = await sr.entities.Campaign.list('-created_date', 200);
    }

    for (const campaign of campaigns) {
      campaignsCovered++;
      const connections = await sr.entities.PlatformConnection.filter({ campaign_id: campaign.id, kind: 'crowdfunding' }, '-updated_date', 50).catch(() => []);
      for (const conn of connections) {
        try {
          if (!campaign.created_by_id || campaign.created_by_id !== conn.created_by_id) {
            throw new Error('Connection ownership does not match campaign ownership.');
          }

          const result = await adapterFor(conn);
          let imported = 0;
          const txIds = [];
          let lastObservation = null;
          let observedCurrency = String(conn.external_currency || '').trim().toUpperCase();

          if ((result.transactions || []).length) await ensureCanonicalCampaign(sr, campaign);

          for (const tx of result.transactions || []) {
            const txId = String(tx.id || tx.transaction_id || '').trim();
            const amount = num(tx.amount);
            const currency = String(tx.currency || conn.external_currency || '').trim().toUpperCase();
            if (!txId) throw new Error(`${conn.platform} transaction missing stable provider id.`);
            if (!(amount > 0)) throw new Error(`${conn.platform} transaction ${txId} has invalid amount.`);
            if (!validCurrency(currency)) throw new Error(`${conn.platform} transaction ${txId} has no valid ISO currency.`);
            if (observedCurrency && observedCurrency !== currency) {
              throw new Error(`${conn.platform} returned ${currency} while this connection total is ${observedCurrency}; conversion/reconciliation is required.`);
            }
            observedCurrency = currency;

            const observation = await recordCanonicalExternalObservation(sr, {
              operationKey: `external:${conn.platform}:${conn.id}:${txId}`,
              provider: String(conn.platform),
              providerTransactionId: txId,
              providerAccountId: String(conn.id),
              campaignId: campaign.id,
              campaignOwnerUserId: campaign.created_by_id,
              amount,
              currency,
              donorName: tx.donor_name || tx.payer_name || 'External supporter',
              ...(tx.donor_email ? { donorEmail: String(tx.donor_email) } : {}),
              source: 'external_funds_sync',
              metadata: JSON.stringify({ connection_id: conn.id, platform: conn.platform }),
            });
            lastObservation = observation;
            if (observation.created) imported++;

            // Keep a Base44 provenance mirror for custody matching. This row is
            // external-only and never creates withdrawable value. It gives the
            // PayPal settlement matcher a concrete campaign/user/provider record
            // without treating an observed external donation as money IF holds.
            const observationKey = `external:${conn.platform}:${conn.id}:${txId}`;
            const mirrored = await sr.entities.ExternalFundObservation.filter({ operation_key: observationKey }).catch(() => []);
            if (!mirrored?.length) {
              await sr.entities.ExternalFundObservation.create({
                operation_key: observationKey,
                provider: String(conn.platform),
                provider_transaction_id: txId,
                external_connection_id: conn.id,
                campaign_id: campaign.id,
                beneficiary_user_id: campaign.created_by_id,
                amount,
                currency,
                observed_at: new Date().toISOString(),
                settlement_state: 'external',
                description: 'Provider-verified exterior funds; not held or withdrawable until receiving PayPal settlement is independently verified.',
              });
            }
            txIds.push(txId);
          }

          const now = new Date().toISOString();
          const update = {
            last_error: result.status === 'error' ? result.note : '',
          };
          if (lastObservation && observedCurrency) {
            update.status = 'connected';
            update.verification_status = 'verified';
            update.external_data_source = 'provider_verified';
            update.last_synced = now;
            update.external_total = Number(lastObservation.observedTotal || 0);
            update.external_donor_count = Number(lastObservation.observedCount || 0);
            update.external_currency = observedCurrency;
          }
          await sr.entities.PlatformConnection.update(conn.id, update);

          const amountDiscovered = num(result.amount_discovered);
          const resultCurrency = observedCurrency || 'UNSPECIFIED';
          discoveredByCurrency.set(resultCurrency, num(discoveredByCurrency.get(resultCurrency)) + amountDiscovered);
          totalImported += imported;
          providerResults.push({
            provider: conn.platform,
            campaign_id: campaign.id,
            status: result.status,
            amount_discovered: amountDiscovered,
            currency: resultCurrency,
            transactions_imported: imported,
            transaction_ids: txIds,
            external_only: true,
            withdrawable_imported: 0,
            error: result.status === 'error' ? result.note : '',
            note: result.note,
          });
        } catch (err) {
          await sr.entities.PlatformConnection.update(conn.id, {
            status: 'error',
            last_error: String(err?.message || 'sync failed').slice(0, 500),
          }).catch(() => {});
          providerResults.push({
            provider: conn.platform,
            campaign_id: campaign.id,
            status: 'error',
            amount_discovered: 0,
            currency: String(conn.external_currency || 'UNSPECIFIED').trim().toUpperCase(),
            transactions_imported: 0,
            transaction_ids: [],
            external_only: true,
            withdrawable_imported: 0,
            error: err?.message || 'sync failed',
            note: '',
          });
        }
      }
    }

    const completedAt = new Date().toISOString();
    const discoveredTotals = [...discoveredByCurrency.entries()].map(([currency, amount]) => ({ currency, amount }));
    const totalDiscoveredUsd = num(discoveredByCurrency.get('USD'));
    const hasError = providerResults.some((r) => r.status === 'error');
    const hasImported = providerResults.some((r) => r.status === 'imported');
    const hasUnavailable = providerResults.some((r) => ['realtime_webhook', 'credentials_required', 'no_read_api'].includes(r.status));
    const overall = providerResults.length === 0
      ? 'no_connections'
      : hasError
        ? (hasImported ? 'partial' : 'failed')
        : hasImported
          ? (hasUnavailable ? 'partial' : 'success')
          : 'unavailable';

    const run = await sr.entities.SyncRun.create({
      initiator_type: initiatorType,
      initiator_id: user ? user.id : (body.initiator_id || 'workflow'),
      initiator_user_id: user ? user.id : null,
      obo_user_id: oboUserId,
      scope,
      campaign_id: body.campaign_id || null,
      started_at: startedAt,
      completed_at: completedAt,
      overall_status: overall,
      provider_results: providerResults,
      total_discovered: totalDiscoveredUsd,
      discovered_totals: discoveredTotals,
      total_imported: totalImported,
      campaigns_covered: campaignsCovered,
    });

    await logAudit(base44, {
      action: 'external_funds_sync',
      actor_user_id: user ? user.id : null,
      target_type: 'SyncRun',
      target_id: run.id,
      detail: `scope=${scope} campaigns=${campaignsCovered} observed_currency_groups=${discoveredTotals.length} new_observations=${totalImported} overall=${overall}`,
      status: ['success', 'partial'].includes(overall) ? 'success' : 'failure',
      metadata: {
        scope,
        obo_user_id: oboUserId,
        overall,
        campaigns_covered: campaignsCovered,
        total_discovered_usd: totalDiscoveredUsd,
        discovered_totals: discoveredTotals,
        total_imported: totalImported,
        withdrawable_imported: 0,
      },
    });

    return Response.json({
      ok: ['success', 'partial'].includes(overall),
      run_id: run.id,
      overall_status: overall,
      campaigns_covered: campaignsCovered,
      total_discovered: totalDiscoveredUsd,
      discovered_totals: discoveredTotals,
      total_imported: totalImported,
      withdrawable_imported: 0,
      provider_results: providerResults,
    });
  } catch (error) {
    console.error('syncExternalFunds error:', error.message);
    return Response.json({ error: 'Synchronization could not complete.' }, { status: 500 });
  }
}
