import { giftOf, round2, computeWithdrawal } from './fees.js';

const TERMINAL_STATES = ['completed', 'cancelled', 'failed'];

// Converge duplicate FinancialOperation records for the same operation_key.
//
// Ordering contract (defect A repair):
//   1. determine the canonical (earliest) record;
//   2. determine whether the records can SAFELY converge — conflicting terminal
//      states (e.g. one completed, one failed) must NOT be merged or deleted;
//   3. persist the canonical merged state;
//   4. only after a successful persist, remove genuinely redundant duplicates.
//
// A persistence failure is NOT silently suppressed — it aborts convergence so
// duplicate state is never destroyed before the canonical record absorbs it.
async function one(sr, operationKey) {
  const rows = await sr.entities.FinancialOperation.filter({ operation_key: operationKey }).catch(() => []);
  if (!rows || rows.length === 0) return null;
  if (rows.length === 1) return rows[0];

  const ordered = [...rows].sort((a, b) => {
    const at = new Date(a.created_date || 0).getTime();
    const bt = new Date(b.created_date || 0).getTime();
    if (at !== bt) return at - bt;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
  const canonical = ordered[0];

  // Detect conflicting terminal states. Completed ≠ cancelled ≠ failed.
  // These represent materially different financial outcomes and must never be
  // silently merged. Retain all evidence and return the earliest without
  // deleting anything; the conflict enters a manual reconciliation path.
  const terminalPresent = new Set(
    ordered.map((r) => r.state).filter((s) => TERMINAL_STATES.includes(s))
  );
  if (terminalPresent.size > 1) {
    // Flag the canonical record for reconciliation review.
    await sr.entities.FinancialOperation.update(canonical.id, {
      note: `CONFLICT: duplicate records with conflicting terminal states (${[...terminalPresent].join(', ')}) exist for this operation. Manual reconciliation required.`
    }).catch(() => {});
    return canonical;
  }

  // Safe convergence: build the merged patch from duplicates. Only forward
  // state to a terminal value if ALL duplicates agree on that terminal state.
  const patch = {};
  const agreedTerminal = terminalPresent.size === 1 ? [...terminalPresent][0] : null;

  for (const dup of ordered.slice(1)) {
    if (agreedTerminal && dup.state === agreedTerminal) {
      patch.state = agreedTerminal;
      if (dup.completed_at) patch.completed_at = dup.completed_at;
      if (dup.cancelled_at) patch.cancelled_at = dup.cancelled_at;
      if (dup.provider_transaction_id) patch.provider_transaction_id = dup.provider_transaction_id;
    } else if (!TERMINAL_STATES.includes(dup.state) && !TERMINAL_STATES.includes(canonical.state)) {
      // Neither is terminal — forward to the more progressed non-terminal state.
      const rank = { pending: 0, applied: 1, reserved: 2 };
      if ((rank[dup.state] || 0) > (rank[canonical.state] || 0)) {
        patch.state = dup.state;
      }
    }
    if (dup.withdrawal_id && !canonical.withdrawal_id) patch.withdrawal_id = dup.withdrawal_id;
    if (dup.provider_transaction_id && !canonical.provider_transaction_id) patch.provider_transaction_id = dup.provider_transaction_id;
  }

  // Step 3: persist canonical state BEFORE any destructive cleanup.
  if (Object.keys(patch).length) {
    await sr.entities.FinancialOperation.update(canonical.id, patch);
    // Step 4: persist succeeded — now safe to remove redundant duplicates.
  }
  for (const dup of ordered.slice(1)) {
    await sr.entities.FinancialOperation.delete(dup.id).catch(() => {});
  }
  return canonical;
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
  const gross = round2(Number(args.requestedGross || 0));
  const donationGross = round2(Number(args.verifiedDonationGross || 0));
  const externalGross = round2(Number(args.verifiedExternalGross || 0));
  if (!(gross > 0) || gross !== round2(donationGross + externalGross)) {
    throw new Error('Verified reserved sources do not match the requested withdrawal.');
  }
  const { fee, net } = computeWithdrawal(gross);
  const op = await sr.entities.FinancialOperation.create({
    operation_key: args.operationKey, operation_type: 'withdrawal_reservation', state: 'reserved',
    campaign_id: args.campaignId, campaign_owner_user_id: args.campaignOwnerUserId,
    gross_amount: gross, platform_fee: fee, net_amount: net, payout_method: args.payoutMethod || '',
    donation_gross_amount: donationGross, external_gross_amount: externalGross,
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
