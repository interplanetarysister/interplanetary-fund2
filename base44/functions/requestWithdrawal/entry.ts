import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendPayout } from '../../shared/paypal.ts';
import { giftOf, round2, computeWithdrawal } from '../../shared/fees.js';
import { logAudit } from '../../shared/auditLog.ts';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { ensureCanonicalCampaign, recordCanonicalDonation, mirrorCanonicalCampaignTotal } from '../../shared/convexFinancial.ts';
import { reconcileDonationMirror, reconcileNotificationMirror } from '../../shared/financialMirrors.ts';

// Withdrawal engine. Enforces the approved 3% platform fee, the 7-day clearing
// hold, a once-daily limit, campaign ownership, and fraud review for large
// payouts. All payouts go out of the platform's PayPal business account.
const CLEARING_DAYS = 7;
const REVIEW_THRESHOLD = 1000; // net amounts above this require admin approval
const SAFE_PAYOUT_ERROR = 'Unable to complete the payout. Please try again or contact support.';
const SAFE_WITHDRAWAL_ERROR = 'Unable to complete the withdrawal request. Please try again or contact support.';
const GENERIC_PAYOUT_REVIEW_NOTE = 'Payout failed. Detailed provider diagnostics are retained in controlled server logs.';

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '');

async function verifyPendingDonation(base44, sr, donation, adminUser) {
  const campaign = await sr.entities.Campaign.get(donation.campaign_id).catch(() => null);
  if (!campaign) throw new Error('Campaign not found for pending donation.');
  await ensureCanonicalCampaign(sr, campaign);

  const institutional = !!donation.is_institutional;
  const method = donation.payment_method === 'cashapp' ? 'cashapp' : donation.payment_method === 'paypal' ? 'paypal' : 'other';
  const provider = institutional ? 'institutional_grant' : `manual_${method === 'cashapp' ? 'cashapp' : 'paypal'}`;
  // New pending rows store the original operation reference in idempotency_key.
  // Legacy rows may not have one; the Base44 donation id is then a stable,
  // one-time fallback so admin verification remains replay-safe.
  const providerReference = String(donation.idempotency_key || donation.id);
  const operationKey = institutional
    ? `institutional_grant:${providerReference}`
    : `${provider}:${providerReference}`;

  let donorEmail;
  if (donation.donor_user_id) {
    const donor = await sr.entities.User.get(donation.donor_user_id).catch(() => null);
    donorEmail = donor?.email || undefined;
  }

  const canonical = await recordCanonicalDonation(sr, {
    operationKey,
    provider,
    providerTransactionId: providerReference,
    campaignId: donation.campaign_id,
    campaignTitle: donation.campaign_title || campaign.title,
    campaignOwnerUserId: campaign.created_by_id || '',
    grossAmount: Number(donation.amount || 0),
    platformContribution: Number(donation.platform_contribution || 0),
    processingFee: Number(donation.processing_fee || 0),
    donorName: donation.donor_name || (institutional ? 'Institutional Grant' : 'Anonymous'),
    ...(donorEmail ? { donorEmail } : {}),
    ...(donation.donor_user_id ? { donorUserId: donation.donor_user_id } : {}),
    message: donation.message || '',
    paymentMethod: method,
    paymentVerified: true,
    source: institutional ? 'admin_verified_institutional_receipt' : 'admin_verified_manual_receipt',
    isRecurring: !!donation.is_recurring,
  });

  if (donation.canonical_operation_id && String(donation.canonical_operation_id) !== String(canonical.operationId)) {
    throw new Error('Canonical operation mismatch while clearing donation.');
  }

  // Legacy pending rows did not have a canonical mirror id. Attach the existing
  // row to the canonical operation before reconciliation so recovery updates it
  // rather than creating a second application Donation.
  if (!donation.canonical_operation_id) {
    await sr.entities.Donation.update(donation.id, { canonical_operation_id: String(canonical.operationId) });
  }

  await mirrorCanonicalCampaignTotal(sr, campaign.id, canonical);
  const mirror = await reconcileDonationMirror(sr, canonical.operationId, {
    campaign_id: donation.campaign_id,
    campaign_title: donation.campaign_title || campaign.title,
    amount: Number(donation.amount || 0),
    platform_contribution: Number(donation.platform_contribution || 0),
    processing_fee: Number(donation.processing_fee || 0),
    donor_name: donation.donor_name || (institutional ? 'Institutional Grant' : 'Anonymous'),
    message: donation.message || '',
    is_recurring: !!donation.is_recurring,
    ...(donation.is_recurring ? { recurring_status: donation.recurring_status || 'active' } : {}),
    ...(donation.donor_user_id ? { donor_user_id: donation.donor_user_id } : {}),
    payment_method: method,
    payment_verified: true,
    is_institutional: institutional,
    cleared: true,
    idempotency_key: providerReference,
  });

  if (campaign.created_by_id) {
    await reconcileNotificationMirror(sr, canonical.operationId, {
      user_id: campaign.created_by_id,
      title: institutional ? 'Institutional funds verified' : 'Donation verified',
      body: institutional
        ? `$${Number(donation.amount || 0).toLocaleString()} in institutional funding for \"${campaign.title}\" was verified as received.`
        : `$${Number(donation.amount || 0).toLocaleString()} for \"${campaign.title}\" was verified as received.`,
      type: 'donation',
      link: `/campaign/${campaign.id}`,
      read: false,
    });
  }

  if (canonical.applied) {
    await logAudit(base44, {
      action: institutional ? 'institutional_funds_verified' : 'manual_donation_verified',
      target_type: 'donation',
      target_id: mirror?.id || donation.id,
      detail: `$${Number(donation.amount || 0)} receipt verified and applied to canonical ledger`,
      status: 'success',
      metadata: {
        actor: adminUser.id,
        canonical_operation_id: String(canonical.operationId),
        campaign_id: campaign.id,
      },
    });
  }

  return { canonical, mirror: mirror || donation };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;

    const body = await req.json();
    const action = body.action || 'request';

    // ---- Admin: verify/clear an off-platform or institutional donation ----
    if (action === 'clear') {
      if (user.role !== 'admin') return Response.json({ error: 'Admin only.' }, { status: 403 });
      const d = await sr.entities.Donation.get(body.donation_id);
      if (!d) return Response.json({ error: 'Donation not found.' }, { status: 404 });
      if (!d.is_institutional && d.payment_verified !== false) {
        // A repeated clear of an already verified mirror is safe and should not
        // manufacture a second canonical event.
        if (d.cleared && d.canonical_operation_id) {
          return Response.json({ ok: true, donation_id: d.id, cleared: true, duplicate: true });
        }
        return Response.json({ error: 'Only unverified or institutional donations need clearing.' }, { status: 400 });
      }

      const { canonical, mirror } = await verifyPendingDonation(base44, sr, d, user);
      return Response.json({
        ok: true,
        donation_id: mirror?.id || d.id,
        cleared: true,
        canonical_operation_id: String(canonical.operationId),
        duplicate: !canonical.applied,
      });
    }

    // ---- Admin: approve a withdrawal held for review ----
    if (action === 'approve') {
      if (user.role !== 'admin') return Response.json({ error: 'Admin only.' }, { status: 403 });
      const w = await sr.entities.Withdrawal.get(body.withdrawal_id);
      if (!w) return Response.json({ error: 'Withdrawal not found.' }, { status: 404 });
      if (w.status !== 'under_review') return Response.json({ error: 'Only held withdrawals can be approved.' }, { status: 400 });
      try {
        const payout = await sendPayout({
          receiver: w.paypal_email,
          amount: w.net_amount,
          note: `Interplanetary Fund withdrawal for \"${w.campaign_title}\"`,
          itemId: `IFW_${w.id}`,
        });
        await sr.entities.Withdrawal.update(w.id, {
          status: 'paid',
          payout_batch_id: payout.payout_batch_id,
          processed_at: new Date().toISOString(),
        });
        await logAudit(base44, { action: 'withdrawal_approved', target_type: 'withdrawal', target_id: w.id, detail: `Approved net $${w.net_amount} paid`, status: 'success', metadata: { actor: user.id } });
        return Response.json({ ok: true, status: 'paid', payout_batch_id: payout.payout_batch_id });
      } catch (err) {
        console.error('requestWithdrawal approve payout error:', err?.message || err);
        await sr.entities.Withdrawal.update(w.id, { status: 'failed', review_note: GENERIC_PAYOUT_REVIEW_NOTE });
        await logAudit(base44, { action: 'withdrawal_approve_failed', target_type: 'withdrawal', target_id: w.id, detail: 'Reviewed payout failed', status: 'failure', metadata: { actor: user.id } });
        return Response.json({ error: SAFE_PAYOUT_ERROR }, { status: 500 });
      }
    }

    // ---- User: request a new withdrawal ----
    const { campaign_id, paypal_email, paypal_email_confirm } = body;
    if (!campaign_id) return Response.json({ error: 'Select a campaign to withdraw from.' }, { status: 400 });
    if (!emailOk(paypal_email)) return Response.json({ error: 'Enter a valid PayPal email address.' }, { status: 400 });
    if (paypal_email !== paypal_email_confirm) return Response.json({ error: 'PayPal email addresses do not match.' }, { status: 400 });

    const campaign = await sr.entities.Campaign.get(campaign_id);
    if (!campaign) return Response.json({ error: 'Campaign not found.' }, { status: 404 });
    if (campaign.created_by_id !== user.id) {
      return Response.json({ error: 'You can only withdraw funds from your own campaigns.' }, { status: 403 });
    }

    // Once-daily limit: any non-failed withdrawal created today blocks a new one.
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const recent = await sr.entities.Withdrawal.filter({ owner_user_id: user.id });
    const alreadyToday = (recent || []).some((w) => {
      if (w.status === 'failed') return false;
      return new Date(w.created_date) >= startToday;
    });
    if (alreadyToday) {
      return Response.json({ error: 'You can only withdraw once per day. Please try again tomorrow.' }, { status: 400 });
    }

    const cutoff = new Date(Date.now() - CLEARING_DAYS * 86400000);
    const allDonations = await sr.entities.Donation.filter({ campaign_id });
    // Explicit admin clearing proves receipt and satisfies the hold. Otherwise,
    // only provider-verified, non-institutional gifts age into availability after
    // seven days. Pending/unverified money can never enter a withdrawal.
    const available = (allDonations || []).filter((d) => {
      if (d.withdrawal_id) return false;
      if (d.cleared) return d.payment_verified !== false;
      if (d.payment_verified === false || d.is_institutional) return false;
      return new Date(d.created_date) <= cutoff;
    });
    let gross = round2(available.reduce((s, d) => s + giftOf(d), 0));
    if (gross <= 0) {
      return Response.json({ error: 'No cleared funds are available yet. Donations become withdrawable after verification and the applicable clearing period.' }, { status: 400 });
    }

    let { fee, net } = computeWithdrawal(gross);

    const withdrawal = await sr.entities.Withdrawal.create({
      owner_user_id: user.id,
      user_name: user.full_name,
      campaign_id,
      campaign_title: campaign.title,
      gross_amount: gross,
      platform_fee: fee,
      net_amount: net,
      paypal_email,
      covered_donation_ids: available.map((d) => d.id),
      status: 'processing',
    });
    await logAudit(base44, { action: 'withdrawal_requested', target_type: 'withdrawal', target_id: withdrawal.id, detail: `Requested $${gross} (fee $${fee}, net $${net})`, status: 'success' });

    // Conditionally reserve only still-unclaimed donations — prevents two
    // concurrent withdrawals from consuming the same funds (double-spend).
    await sr.entities.Donation.updateMany(
      { id: { $in: available.map((d) => d.id) }, withdrawal_id: { $in: [null, ''] } },
      { $set: { withdrawal_id: withdrawal.id } }
    );

    // Re-read to confirm which donations we actually reserved — a concurrent
    // request may have claimed some of them before our conditional update.
    const reChecked = await sr.entities.Donation.filter({ withdrawal_id: withdrawal.id });
    const reservedIds = (reChecked || []).map((d) => d.id);
    const reservedGross = round2(reservedIds.reduce((s, id) => {
      const d = available.find((a) => a.id === id);
      return s + (d ? giftOf(d) : 0);
    }, 0));

    if (reservedGross <= 0) {
      await sr.entities.Withdrawal.update(withdrawal.id, { status: 'failed', review_note: 'Funds were claimed by another withdrawal. Please try again.' });
      return Response.json({ error: 'Those funds were just claimed by another withdrawal. Please try again.' }, { status: 409 });
    }
    if (reservedGross !== gross) {
      gross = reservedGross;
      ({ fee, net } = computeWithdrawal(gross));
      await sr.entities.Withdrawal.update(withdrawal.id, {
        gross_amount: gross,
        platform_fee: fee,
        net_amount: net,
        covered_donation_ids: reservedIds,
      });
    }

    // Large payouts are held for manual admin review (fraud protection).
    if (net > REVIEW_THRESHOLD) {
      await sr.entities.Withdrawal.update(withdrawal.id, {
        status: 'under_review',
        review_note: `Net amount $${net.toFixed(2)} exceeds the $${REVIEW_THRESHOLD} auto-approval threshold.`,
      });
      await logAudit(base44, { action: 'withdrawal_held', target_type: 'withdrawal', target_id: withdrawal.id, detail: `Held for review (net $${net})`, status: 'success' });
      return Response.json({ ok: true, status: 'under_review', withdrawal_id: withdrawal.id, gross, fee, net });
    }

    try {
      const payout = await sendPayout({
        receiver: paypal_email,
        amount: net,
        note: `Interplanetary Fund withdrawal for \"${campaign.title}\"`,
        itemId: `IFW_${withdrawal.id}`,
      });
      await sr.entities.Withdrawal.update(withdrawal.id, {
        status: 'paid',
        payout_batch_id: payout.payout_batch_id,
        processed_at: new Date().toISOString(),
      });
      await logAudit(base44, { action: 'withdrawal_paid', target_type: 'withdrawal', target_id: withdrawal.id, detail: `Net $${net} paid`, status: 'success' });
      return Response.json({ ok: true, status: 'paid', withdrawal_id: withdrawal.id, gross, fee, net, payout_batch_id: payout.payout_batch_id });
    } catch (err) {
      // Payout failed — release only the donations we actually reserved.
      console.error('requestWithdrawal payout error:', err?.message || err);
      await sr.entities.Donation.updateMany(
        { withdrawal_id: withdrawal.id },
        { $set: { withdrawal_id: '' } }
      );
      await sr.entities.Withdrawal.update(withdrawal.id, { status: 'failed', review_note: GENERIC_PAYOUT_REVIEW_NOTE });
      await logAudit(base44, { action: 'withdrawal_failed', target_type: 'withdrawal', target_id: withdrawal.id, detail: 'Payout failed; funds released', status: 'failure' });
      return Response.json({ error: `${SAFE_PAYOUT_ERROR} Your funds were released back to your available balance.` }, { status: 500 });
    }
  } catch (error) {
    console.error('requestWithdrawal error:', error?.message || error);
    return Response.json({ error: SAFE_WITHDRAWAL_ERROR }, { status: 500 });
  }
}
