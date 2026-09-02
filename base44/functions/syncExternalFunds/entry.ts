import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logAudit } from '../../shared/auditLog.ts';

// Centralized, server-authoritative external-fund synchronization engine.
// ONE engine used by every entry point: scheduled daily sync, "Count My Money",
// "Sync Linked Platforms", and "Migrate Funds" reconciliation. Do not maintain
// separate implementations — call this function from all of them.
//
// Guarantees:
//  - Idempotent imports: stable provider transaction id is claimed via
//    WebhookEvent + checked against Donation.stripe_session_id, so retries,
//    scheduled runs, and manual syncs can never double-count a donation.
//  - Per-provider isolation: a failure from one provider is recorded but never
//    blocks another provider or campaign.
//  - Client-entered totals are NOT authoritative: only server-verified imports
//    update the ledger. Owner-reported external_total is surfaced separately as
//    non-authoritative.
//  - Audit: every run records a SyncRun + an audit-log entry.
//
// Honesty: most external crowdfunding platforms expose no public read API. The
// adapter map reports exactly what is available per platform instead of
// simulating success. When a platform API + token become available, add the
// fetcher in adapterFor() — the idempotent import path below already handles it.

const num = (v) => (typeof v === 'number' ? v : Number(v) || 0);

// Per-platform adapter. Returns { status, amount_discovered, transactions, note }.
// status: imported | realtime_webhook | no_read_api | credentials_required | error
async function adapterFor(connection) {
  const p = connection.platform;
  if (p === 'kofi') {
    // Ko-fi donations sync in real time via the kofiWebhook; there is no pull API
    // to re-fetch transactions. The owner-reported external_total is maintained
    // by the webhook and shown here for reconciliation.
    return { status: 'realtime_webhook', amount_discovered: num(connection.external_total), transactions: [], note: 'Ko-fi donations sync in real time via webhook; no pull API to re-fetch.' };
  }
  if (p === 'buymeacoffee' || p === 'patreon') {
    // These platforms have a supporter/transactions API, but live import requires
    // a per-connection access token credential that is not yet stored. Do not
    // simulate; report credentials_required so the owner can connect it properly.
    return { status: 'credentials_required', amount_discovered: num(connection.external_total), transactions: [], note: `${p} API supported — add an access token credential to enable live import. Owner-reported total shown, not authoritative.` };
  }
  // GoFundMe, Kickstarter, Indiegogo (partner), GiveSendGo, Spotfund, custom:
  // no public read API. Owner-reported external_total only — never authoritative.
  return { status: 'no_read_api', amount_discovered: num(connection.external_total), transactions: [], note: `${p} has no public read API — owner-reported total only, not authoritative.` };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { /* scheduled/workflow call: no user */ }
    const body = await req.json().catch(() => ({}));
    const initiatorType = body.initiator_type || (user ? 'user' : 'scheduled');
    const oboUserId = body.obo_user_id || null;

    // Authorization: a user may only sync their own funds. Admins may sync all
    // or pass an explicit on-behalf-of user. Scheduled/workflow runs are
    // service-scoped (no user) and run across all campaigns.
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

    // Resolve target campaigns.
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
        // Per-provider isolation: a failure here is recorded but never breaks the run.
        try {
          const result = await adapterFor(conn);
          let imported = 0;
          const txIds = [];
          for (const tx of result.transactions || []) {
            const txId = String(tx.id || tx.transaction_id || '');
            if (!txId) continue;
            // Idempotency: WebhookEvent claim keyed by provider + transaction id.
            const eventKey = `import:${conn.platform}:${txId}`;
            const prior = await sr.entities.WebhookEvent.filter({ source: 'import', event_key: eventKey }, '-created_date', 1).catch(() => []);
            if (prior && prior.length) continue;
            const claim = await sr.entities.WebhookEvent.create({ source: 'import', event_key: eventKey, processed_at: new Date().toISOString() });
            try {
              const amount = num(tx.amount);
              const existing = await sr.entities.Donation.filter({ stripe_session_id: txId }).catch(() => []);
              if (!existing.length) {
                await sr.entities.Donation.create({
                  campaign_id: campaign.id,
                  campaign_title: campaign.title,
                  amount,
                  platform_contribution: 0,
                  donor_name: tx.donor_name || 'Anonymous',
                  message: tx.message || '',
                  payment_method: 'other',
                  payment_verified: false, // external import — requires admin clearing before withdrawal
                  stripe_session_id: txId,
                });
                await sr.entities.Campaign.updateMany({ id: campaign.id }, { $inc: { raised_amount: amount, donor_count: 1 } });
                imported++;
                txIds.push(txId);
              }
            } catch (impErr) {
              // Release the claim so a retry can reprocess.
              await sr.entities.WebhookEvent.delete(claim.id).catch(() => {});
              throw impErr;
            }
          }
          const now = new Date().toISOString();
          await sr.entities.PlatformConnection.updateMany({ id: conn.id }, { $set: { last_synced: now, last_error: result.status === 'error' ? result.note : '' } });
          totalDiscovered += num(result.amount_discovered);
          totalImported += imported;
          providerResults.push({ provider: conn.platform, campaign_id: campaign.id, status: result.status, amount_discovered: num(result.amount_discovered), transactions_imported: imported, transaction_ids: txIds, error: result.status === 'error' ? result.note : '', note: result.note });
        } catch (err) {
          providerResults.push({ provider: conn.platform, campaign_id: campaign.id, status: 'error', amount_discovered: 0, transactions_imported: 0, transaction_ids: [], error: err.message || 'sync failed', note: '' });
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
      detail: `scope=${scope} campaigns=${campaignsCovered} discovered=$${totalDiscovered} imported=${totalImported} overall=${overall}`,
      status: overall === 'failed' ? 'failure' : 'success',
      metadata: { scope, obo_user_id: oboUserId, overall, campaigns_covered: campaignsCovered, total_discovered: totalDiscovered, total_imported: totalImported },
    });

    return Response.json({ ok: true, run_id: run.id, overall_status: overall, campaigns_covered: campaignsCovered, total_discovered: totalDiscovered, total_imported: totalImported, provider_results: providerResults });
  } catch (error) {
    console.error('syncExternalFunds error:', error.message);
    return Response.json({ error: 'Synchronization could not complete.' }, { status: 500 });
  }
}