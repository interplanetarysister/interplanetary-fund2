import { giftOf, round2, computeWithdrawal } from './fees.js';

// Base44-native financial authority. The filename is retained temporarily to
// avoid a risky repository-wide import rename while the old Convex runtime is
// retired. No function in this module calls Convex or Vercel.
async function findOperation(sr, operationKey) {
  const rows = await sr.entities.FinancialOperation.filter({ operation_key: String(operationKey) }, '-created_date', 2).catch(() => []);
  if (rows.length > 1) throw new Error(`Duplicate financial operation key detected: ${operationKey}`);
  return rows[0] || null;
}
async function campaignTotals(sr, campaignId) {
  const rows = await sr.entities.FinancialOperation.filter({ campaign_id: campaignId }, '-created_date', 5000).catch(() => []);
  if (rows.length >= 5000) throw new Error('Financial ledger exceeds the safe aggregation batch size.');
  const donations = rows.filter((r) => r.operation_type === 'donation' && r.status === 'confirmed' && r.payment_verified === true);
  return { raisedAmount: round2(donations.reduce((sum, r) => sum + giftOf({ amount: r.gross_amount, platform_contribution: r.platform_contribution }), 0)), donorCount: donations.length };
}
export async function ensureCanonicalCampaign(sr, campaign) {
  if (!campaign?.id) throw new Error('Campaign is required for financial registration.');
  const totals = await campaignTotals(sr, campaign.id);
  return { campaignId: campaign.id, ...totals, needsLegacyBaseline: false };
}
export async function recordCanonicalDonation(sr, args) {
  if (!args?.operationKey || !args?.campaignId) throw new Error('Donation operation key and campaign are required.');
  const existing = await findOperation(sr, args.operationKey);
  if (existing) {
    let applied = false;
    let status = existing.status;
    if (existing.operation_type !== 'donation' || existing.campaign_id !== String(args.campaignId)) throw new Error('Financial idempotency key conflicts with another operation.');
    if (args.paymentVerified === true && existing.payment_verified !== true && existing.status === 'pending') {
      await sr.entities.FinancialOperation.update(existing.id, { payment_verified: true, status: 'confirmed', provider_transaction_id: String(args.providerTransactionId || existing.provider_transaction_id || ''), metadata: { ...(existing.metadata || {}), verification_source: args.source || 'verified' } });
      applied = true; status = 'confirmed';
    }
    const totals = await campaignTotals(sr, args.campaignId);
    return { operationId: existing.id, applied, status: applied ? status : (status === 'pending' ? 'pending_duplicate' : 'duplicate'), ...totals };
  }
  const verified = args.paymentVerified === true;
  const row = await sr.entities.FinancialOperation.create({ operation_key: String(args.operationKey), operation_type: 'donation', campaign_id: String(args.campaignId), campaign_owner_user_id: String(args.campaignOwnerUserId || ''), provider: String(args.provider || args.paymentMethod || ''), provider_transaction_id: String(args.providerTransactionId || ''), gross_amount: Number(args.grossAmount || 0), platform_contribution: Number(args.platformContribution || 0), processing_fee: Number(args.processingFee || 0), payment_verified: verified, status: verified ? 'confirmed' : 'pending', metadata: { campaign_title: args.campaignTitle || '', donor_name: args.donorName || '', donor_email: args.donorEmail || '', donor_user_id: args.donorUserId || '', message: args.message || '', source: args.source || '', is_recurring: !!args.isRecurring } });
  const totals = await campaignTotals(sr, args.campaignId);
  return { operationId: row.id, applied: true, status: row.status, ...totals };
}
export async function recordCanonicalExternalObservation(sr, args) {
  if (!args?.operationKey || !args?.campaignId) throw new Error('External observation key and campaign are required.');
  const existing = await findOperation(sr, args.operationKey);
  if (existing) return { operationId: existing.id, applied: false, status: 'duplicate' };
  const row = await sr.entities.FinancialOperation.create({ operation_key: String(args.operationKey), operation_type: 'external_observation', campaign_id: String(args.campaignId), campaign_owner_user_id: String(args.campaignOwnerUserId || ''), provider: String(args.provider || ''), provider_transaction_id: String(args.providerTransactionId || ''), gross_amount: Number(args.grossAmount || args.amount || 0), payment_verified: args.paymentVerified === true, status: 'observed', metadata: args });
  return { operationId: row.id, applied: true, status: 'observed' };
}
export async function reserveCanonicalWithdrawal(sr, args) {
  if (!args?.operationKey || !args?.campaignId) throw new Error('Withdrawal operation key and campaign are required.');
  const existing = await findOperation(sr, args.operationKey);
  if (existing) {
    if (!['reserved', 'completed'].includes(existing.status)) throw new Error('Existing withdrawal operation is not reservable.');
    return { reservationId: existing.reservation_id || existing.id, ledgerEntryId: existing.id, grossAmount: existing.gross_amount, platformFee: existing.platform_fee, netAmount: existing.net_amount };
  }
  const requested = round2(Number(args.requestedGross || 0));
  if (!(requested > 0)) throw new Error('Withdrawal amount must be positive.');
  const totals = await campaignTotals(sr, args.campaignId);
  const withdrawals = await sr.entities.FinancialOperation.filter({ campaign_id: args.campaignId, operation_type: 'withdrawal' }, '-created_date', 5000).catch(() => []);
  const committed = round2(withdrawals.filter((r) => ['reserved', 'completed'].includes(r.status)).reduce((s, r) => s + Number(r.gross_amount || 0), 0));
  if (requested > round2(totals.raisedAmount - committed)) throw new Error('Requested withdrawal exceeds the verified available balance.');
  const { fee, net } = computeWithdrawal(requested); const reservationId = `b44:${String(args.operationKey)}`;
  const row = await sr.entities.FinancialOperation.create({ operation_key: String(args.operationKey), operation_type: 'withdrawal', campaign_id: String(args.campaignId), campaign_owner_user_id: String(args.campaignOwnerUserId || ''), gross_amount: requested, platform_fee: Number(fee), net_amount: Number(net), status: 'reserved', reservation_id: reservationId, payout_method: String(args.payoutMethod || ''), payout_destination: String(args.payoutDestination || '') });
  return { reservationId, ledgerEntryId: row.id, grossAmount: requested, platformFee: Number(fee), netAmount: Number(net) };
}
export async function completeCanonicalWithdrawal(sr, args) {
  const row = await findOperation(sr, args?.operationKey); if (!row || row.operation_type !== 'withdrawal') throw new Error('Withdrawal reservation not found.');
  if (row.status === 'completed') return { operationId: row.id, duplicate: true }; if (row.status !== 'reserved') throw new Error('Withdrawal reservation is not active.');
  await sr.entities.FinancialOperation.update(row.id, { status: 'completed', provider_transaction_id: String(args.providerTransactionId || ''), completed_at: new Date().toISOString() }); return { operationId: row.id, completed: true };
}
export async function cancelCanonicalWithdrawal(sr, args) {
  const row = await findOperation(sr, args?.operationKey); if (!row || row.operation_type !== 'withdrawal') throw new Error('Withdrawal reservation not found.');
  if (row.status === 'completed') throw new Error('Completed withdrawal cannot be cancelled.'); if (row.status === 'cancelled') return { operationId: row.id, duplicate: true };
  await sr.entities.FinancialOperation.update(row.id, { status: 'cancelled', cancelled_at: new Date().toISOString(), metadata: { ...(row.metadata || {}), cancellation_reason: args.reason || '' } }); return { operationId: row.id, cancelled: true };
}
export async function mirrorCanonicalCampaignTotal(sr, campaignId, canonical) {
  const totals = canonical && Number.isFinite(Number(canonical.raisedAmount)) ? { raisedAmount: Number(canonical.raisedAmount), donorCount: Number(canonical.donorCount || 0) } : await campaignTotals(sr, campaignId);
  await sr.entities.Campaign.update(campaignId, { raised_amount: totals.raisedAmount, donor_count: totals.donorCount });
}
