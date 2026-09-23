import { giftOf, round2, computeWithdrawal } from './fees.js';

async function one(sr, operationKey) {
  const rows = await sr.entities.FinancialOperation.filter({ operation_key: operationKey }).catch(() => []);
  return rows?.[0] || null;
}

export async function ensureCanonicalCampaign(sr, campaign) {
  if (!campaign?.id) throw new Error('Campaign is required for financial registration.');
  const rows = await sr.entities.Donation.filter({ campaign_id: campaign.id }, '-created_date', 5000).catch(() => []);
  if (rows.length >= 5000) throw new Error('Campaign financial baseline exceeds the safe batch size.');
  const verified = rows.filter((d) => d.payment_verified === true && (!d.is_institutional || d.cleared === true));
  const raisedAmount = round2(verified.reduce((s,d) => s + giftOf(d), 0));
  const donorCount = verified.length;
  const availableBalance = round2(verified.filter((d) => !d.withdrawal_id).reduce((s,d) => s + giftOf(d), 0));
  return { campaignId: campaign.id, raisedAmount, donorCount, availableBalance, needsLegacyBaseline: false };
}

export async function recordCanonicalDonation(sr, args) {
  const prior = await one(sr, args.operationKey);
  if (prior) {
    const campaign = await sr.entities.Campaign.get(args.campaignId);
    const totals = await ensureCanonicalCampaign(sr, campaign);
    return { operationId: prior.id, applied: false, ...totals };
  }
  const op = await sr.entities.FinancialOperation.create({
    operation_key: args.operationKey, operation_type: 'donation', state: 'applied',
    campaign_id: args.campaignId, campaign_owner_user_id: args.campaignOwnerUserId || '',
    provider: args.provider || '', provider_transaction_id: args.providerTransactionId || '',
    gross_amount: Number(args.grossAmount || 0), platform_contribution: Number(args.platformContribution || 0),
    processing_fee: Number(args.processingFee || 0)
  });
  const campaign = await sr.entities.Campaign.get(args.campaignId);
  const totals = await ensureCanonicalCampaign(sr, campaign);
  return { operationId: op.id, applied: true, ...totals };
}

export async function recordCanonicalExternalObservation(sr, args) {
  const prior = await one(sr, args.operationKey);
  if (prior) return { operationId: prior.id, created: false };
  const op = await sr.entities.FinancialOperation.create({
    operation_key: args.operationKey, operation_type: 'external_observation', state: 'applied',
    campaign_id: args.campaignId, campaign_owner_user_id: args.campaignOwnerUserId || '',
    provider: args.provider || '', provider_transaction_id: args.providerTransactionId || '',
    gross_amount: Number(args.amount || args.grossAmount || 0)
  });
  return { operationId: op.id, created: true };
}

export async function reserveCanonicalWithdrawal(sr, args) {
  const prior = await one(sr, args.operationKey);
  if (prior) {
    if (prior.state === 'cancelled' || prior.state === 'failed') throw new Error('Withdrawal reservation is no longer active.');
    return { reservationId: prior.id, ledgerEntryId: prior.id, grossAmount: prior.gross_amount, platformFee: prior.platform_fee, netAmount: prior.net_amount };
  }
  const campaign = await sr.entities.Campaign.get(args.campaignId);
  if (!campaign || campaign.created_by_id !== args.campaignOwnerUserId) throw new Error('Campaign ownership mismatch.');
  const totals = await ensureCanonicalCampaign(sr, campaign);
  const gross = round2(Number(args.requestedGross || 0));
  if (!(gross > 0) || gross > totals.availableBalance) throw new Error('Insufficient verified available balance.');
  const { fee, net } = computeWithdrawal(gross);
  const op = await sr.entities.FinancialOperation.create({
    operation_key: args.operationKey, operation_type: 'withdrawal_reservation', state: 'reserved',
    campaign_id: args.campaignId, campaign_owner_user_id: args.campaignOwnerUserId,
    gross_amount: gross, platform_fee: fee, net_amount: net, payout_method: args.payoutMethod || '',
    payout_destination_ref: args.payoutDestination ? 'configured' : ''
  });
  return { reservationId: op.id, ledgerEntryId: op.id, grossAmount: gross, platformFee: fee, netAmount: net };
}

export async function completeCanonicalWithdrawal(sr, args) {
  const op = await one(sr, args.operationKey);
  if (!op) throw new Error('Withdrawal reservation not found.');
  if (op.state === 'completed') return { operationId: op.id, applied: false };
  if (op.state !== 'reserved') throw new Error('Withdrawal reservation is not active.');
  await sr.entities.FinancialOperation.update(op.id, { state: 'completed', provider_transaction_id: String(args.providerTransactionId || ''), completed_at: new Date().toISOString() });
  return { operationId: op.id, applied: true };
}

export async function cancelCanonicalWithdrawal(sr, args) {
  const op = await one(sr, args.operationKey);
  if (!op) throw new Error('Withdrawal reservation not found.');
  if (op.state === 'cancelled') return { operationId: op.id, applied: false };
  if (op.state === 'completed') throw new Error('Completed withdrawal cannot be cancelled.');
  await sr.entities.FinancialOperation.update(op.id, { state: 'cancelled', cancelled_at: new Date().toISOString(), note: String(args.reason || '') });
  return { operationId: op.id, applied: true };
}

export async function mirrorCanonicalCampaignTotal(sr, campaignId, canonical) {
  if (!canonical || !Number.isFinite(Number(canonical.raisedAmount)) || !Number.isFinite(Number(canonical.donorCount))) return;
  await sr.entities.Campaign.update(campaignId, { raised_amount: Number(canonical.raisedAmount), donor_count: Number(canonical.donorCount) });
}
