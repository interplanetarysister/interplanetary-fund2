import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logAudit } from '../../shared/auditLog.ts';
import { ensureCanonicalCampaign, recordCanonicalExternalObservation } from '../../shared/convexFinancial.ts';

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
// - Convex transaction identity is the authoritative dedupe boundary.
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
      amount_discovered: num(connection.external_total),
      transactions: [],
      note: 'Ko-fi payments synchronize in real time through the canonical webhook observation path; no pull API is used.',
    };
  }
  if (p === 'buymeacoffee' || p === 'patreon') {
    return {
      status: 'credentials_required',
      amount_discovered: num(connection.external_total),
      transactions: [],
      note: `${p} transaction discovery requires a valid per-connection access token. Existing owner-reported totals remain informational only.`,
    };
  }
  return {
    status: 'no_read_api',
    amount_discovered: num(connection.external_total),
    transactions: [],
    note: `${p} has no configured authoritative read adapter. Existing external totals are informational only.`,
  };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { /* scheduled/workflow call */ }
    const body = await req.json().catch(() => ({}));
    const initiatorType = body.initiator_type || (user ? 'user' : 'scheduled');
    const oboUserId = body.obo_user_id || null;

    const scope = body.scope || (user ? 'user' : 'all');
    if (user && user.role !== 'admin' && (scope === 'all' || (oboUserId && oboUserId !== user.id))) {
      return Response.json({ error: 'You can only synchronize your own funds.' }, { status: 403 });
    }

    const targetUserId = oboUserId || (scope === 'user' && user ? user.id : null);
    const startedAt = new Date().toISOString();
    const providerResults = [];
    let totalDiscovered = 0;
    let totalImported = 0;
    let campaignsCovered = 0;

    let campaigns = [];
    if (body.campaign_id) {
      const c = await sr.entities.Campaign.get(body.campaign_id).catch(() => null);
      if (c) campaigns = [c];
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
            txIds.push(txId);
          }

          const now = new Date().toISOString();
          const update = {
            last_synced: now,
            last_error: result.status === 'error' ? result.note : '',
          };
          if (lastObservation && observedCurrency) {
            update.external_total = Number(lastObservation.observedTotal || 0);
            update.external_donor_count = Number(lastObservation.observedCount || 0);
            update.external_currency = observedCurrency;
          }
          await sr.entities.PlatformConnection.update(conn.id, update);

          totalDiscovered += num(result.amount_discovered);
          totalImported += imported;
          providerResults.push({
            provider: conn.platform,
            campaign_id: campaign.id,
            status: result.status,
            amount_discovered: num(result.amount_discovered),
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
            last_synced: new Date().toISOString(),
            last_error: String(err?.message || 'sync failed').slice(0, 500),
          }).catch(() => {});
          providerResults.push({
            provider: conn.platform,
            campaign_id: campaign.id,
            status: 'error',
            amount_discovered: 0,
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
    const hasError = providerResults.some((r) => r.status === 'error');
    const hasOk = providerResults.some((r) => r.status !== 'error');
    const overall = hasError ? (hasOk ? 'partial' : 'failed') : 'success';

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
      total_discovered: totalDiscovered,
      total_imported: totalImported,
      campaigns_covered: campaignsCovered,
    });

    await logAudit(base44, {
      action: 'external_funds_sync',
      actor_user_id: user ? user.id : null,
      target_type: 'SyncRun',
      target_id: run.id,
      detail: `scope=${scope} campaigns=${campaignsCovered} observed=$${totalDiscovered} new_observations=${totalImported} overall=${overall}`,
      status: overall === 'failed' ? 'failure' : 'success',
      metadata: {
        scope,
        obo_user_id: oboUserId,
        overall,
        campaigns_covered: campaignsCovered,
        total_discovered: totalDiscovered,
        total_imported: totalImported,
        withdrawable_imported: 0,
      },
    });

    return Response.json({
      ok: true,
      run_id: run.id,
      overall_status: overall,
      campaigns_covered: campaignsCovered,
      total_discovered: totalDiscovered,
      total_imported: totalImported,
      withdrawable_imported: 0,
      provider_results: providerResults,
    });
  } catch (error) {
    console.error('syncExternalFunds error:', error.message);
    return Response.json({ error: 'Synchronization could not complete.' }, { status: 500 });
  }
}
