import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { getTransaction } from '../../shared/paypal.ts';
import { recordCanonicalDonation } from '../../shared/base44Financial.ts';
import { reconcileDonationMirror, reconcileNotificationMirror } from '../../shared/financialMirrors.ts';
import { logAudit } from '../../shared/auditLog.ts';

const SUPER_ADMIN_OWNER_EMAILS = new Set([
  'cuddlemeplatonically@gmail.com',
  'interplanetarysister@gmail.com',
]);
const isSuperAdminOwner = (user) =>
  user?.role === 'admin' &&
  SUPER_ADMIN_OWNER_EMAILS.has(String(user?.email || '').trim().toLowerCase());
const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

async function existingAllocation(sr, transactionId) {
  const [ops, donations, holdings] = await Promise.all([
    sr.entities.FinancialOperation.filter({ provider_transaction_id: transactionId }, '-created_date', 20).catch(() => []),
    sr.entities.Donation.filter({ provider_transaction_id: transactionId }, '-created_date', 20).catch(() => []),
    sr.entities.HoldingLedgerEntry.filter({ provider_transaction_id: transactionId }, '-created_date', 20).catch(() => []),
  ]);
  return { ops: ops || [], donations: donations || [], holdings: holdings || [] };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isSuperAdminOwner(user)) {
      return Response.json({ error: 'Forbidden — super admin only.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const transactionId = String(body.paypal_transaction_id || '').trim();
    const campaignId = String(body.campaign_id || '').trim();
    const donorName = String(body.donor_name || 'Recovered PayPal supporter').trim().slice(0, 160);
    if (!transactionId || !campaignId) {
      return Response.json({ error: 'PayPal transaction and campaign are required.' }, { status: 400 });
    }

    const tx = await getTransaction(transactionId).catch(() => null);
    if (!tx || tx.id !== transactionId || tx.status !== 'S') {
      return Response.json({ error: 'A settled PayPal receipt could not be verified.' }, { status: 409 });
    }
    if (String(tx.currency || '').toUpperCase() !== 'USD' || !(Number(tx.amount) > 0)) {
      return Response.json({ error: 'Only positive USD PayPal receipts can be recovered here.' }, { status: 409 });
    }
    if (Number(tx.feeAmount || 0) > 0 && String(tx.feeCurrency || tx.currency || '').toUpperCase() !== 'USD') {
      return Response.json({ error: 'PayPal fee currency does not match this USD receipt.' }, { status: 409 });
    }

    const campaign = await sr.entities.Campaign.get(campaignId).catch(() => null);
    if (!campaign?.created_by_id) return Response.json({ error: 'Campaign not found or has no owner.' }, { status: 404 });

    const before = await existingAllocation(sr, transactionId);
    const existingRows = [...before.ops, ...before.donations, ...before.holdings];
    if (existingRows.length) {
      const sameCampaign = existingRows.every((row) => !row.campaign_id || row.campaign_id === campaignId);
      if (!sameCampaign) {
        return Response.json({ error: 'This PayPal receipt is already allocated to another campaign.' }, { status: 409 });
      }
      return Response.json({
        ok: true,
        duplicate: true,
        campaign_id: campaignId,
        paypal_transaction_id: transactionId,
      });
    }

    const providerGross = round2(tx.amount);
    const processorFee = round2(Math.abs(Number(tx.feeAmount || 0)));
    const recoveredAmount = round2(providerGross - processorFee);
    if (!(recoveredAmount > 0)) {
      return Response.json({ error: 'PayPal receipt has no recoverable amount after provider fees.' }, { status: 409 });
    }

    // This stable operation key is independent of the selected campaign so two
    // concurrent allocation attempts for the same PayPal receipt converge on
    // one financial identity instead of creating separate campaign operations.
    const operationKey = `paypal:legacy-direct:${transactionId}`;
    const canonical = await recordCanonicalDonation(sr, {
      operationKey,
      provider: 'paypal',
      providerTransactionId: transactionId,
      campaignId,
      campaignTitle: campaign.title || '',
      campaignOwnerUserId: campaign.created_by_id,
      grossAmount: recoveredAmount,
      platformContribution: 0,
      processingFee: processorFee,
      donorName,
      message: 'Recovered from a verified direct PayPal receipt that bypassed IFund campaign checkout.',
      paymentMethod: 'paypal',
      paymentVerified: true,
      source: 'admin_recovered_legacy_direct_paypal',
      isRecurring: false,
    });

    const canonicalOp = await sr.entities.FinancialOperation.get(canonical.operationId).catch(() => null);
    if (!canonicalOp || canonicalOp.campaign_id !== campaignId || canonicalOp.provider_transaction_id !== transactionId) {
      return Response.json({ error: 'Canonical receipt allocation conflicts with the selected campaign.' }, { status: 409 });
    }

    const holdingKey = `holding:paypal:legacy-direct:${transactionId}`;
    const priorHolding = await sr.entities.HoldingLedgerEntry.filter({ operation_key: holdingKey }, 'created_date', 20).catch(() => []);
    if (!priorHolding.length) {
      await sr.entities.HoldingLedgerEntry.create({
        operation_key: holdingKey,
        direction: 'in',
        state: 'settled',
        source_type: 'payment_processor',
        source_provider: 'paypal',
        source_account_ref: 'interplanetary_business_paypal',
        provider_transaction_id: transactionId,
        campaign_id: campaignId,
        beneficiary_user_id: campaign.created_by_id,
        amount: recoveredAmount,
        currency: 'USD',
        platform_contribution: 0,
        processing_fee: processorFee,
        canonical_operation_id: String(canonical.operationId),
        settled_at: tx.transactionUpdatedDate || tx.transactionInitiationDate || new Date().toISOString(),
        reconciliation_note: `Recovered legacy direct PayPal receipt. Provider gross USD ${providerGross.toFixed(2)}, PayPal fee USD ${processorFee.toFixed(2)}, campaign value USD ${recoveredAmount.toFixed(2)}.`,
      });
    }

    const donation = await reconcileDonationMirror(sr, canonical.operationId, {
      campaign_id: campaignId,
      campaign_title: campaign.title || '',
      amount: recoveredAmount,
      platform_contribution: 0,
      processing_fee: processorFee,
      donor_name: donorName || 'Recovered PayPal supporter',
      message: 'Recovered from a verified direct PayPal receipt.',
      is_recurring: false,
      payment_method: 'paypal',
      payment_verified: true,
      cleared: false,
      provider_transaction_id: transactionId,
      description: `Legacy direct PayPal recovery; provider gross ${providerGross.toFixed(2)}, fee ${processorFee.toFixed(2)}.`,
    });

    await reconcileNotificationMirror(sr, canonical.operationId, {
      user_id: campaign.created_by_id,
      title: 'PayPal donation recovered',
      body: `A verified PayPal receipt added $${recoveredAmount.toFixed(2)} to “${campaign.title || 'your campaign'}”.`,
      type: 'donation',
      link: `/campaign/${campaignId}`,
      read: false,
    });

    await logAudit(base44, {
      action: 'legacy_paypal_campaign_donation_recovered',
      actor_user_id: user.id,
      target_type: 'Donation',
      target_id: donation.id,
      detail: `Recovered verified PayPal receipt ${transactionId} to campaign ${campaignId}.`,
      status: 'success',
      metadata: {
        canonical_operation_id: String(canonical.operationId),
        paypal_transaction_id: transactionId,
        campaign_id: campaignId,
        provider_gross: providerGross,
        processor_fee: processorFee,
        campaign_amount: recoveredAmount,
      },
    });

    return Response.json({
      ok: true,
      duplicate: false,
      campaign_id: campaignId,
      paypal_transaction_id: transactionId,
      provider_gross: providerGross,
      processor_fee: processorFee,
      campaign_amount: recoveredAmount,
      canonical_operation_id: String(canonical.operationId),
      donation_id: donation.id,
    });
  } catch (error) {
    console.error('reconcileDirectPayPalCampaignDonation error:', error instanceof Error ? error.message : String(error));
    return Response.json({ error: 'PayPal campaign recovery could not complete safely.' }, { status: 500 });
  }
}
