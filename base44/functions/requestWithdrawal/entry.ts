import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPayoutBatch, sendPayout } from '../../shared/paypal.ts';

// Withdrawal engine. Enforces the 8% platform fee, the 7-day clearing hold,
// a once-daily limit, campaign ownership, and fraud review for large payouts.
// All payouts go out of the platform's PayPal business account.
const PLATFORM_FEE_RATE = 0.08;
const CLEARING_DAYS = 7;
const REVIEW_THRESHOLD = 1000; // net amounts above this require admin approval
const SAFE_PAYOUT_ERROR = 'Unable to complete the payout. Please try again or contact support.';
const SAFE_WITHDRAWAL_ERROR = 'Unable to complete the withdrawal request. Please try again or contact support.';
const GENERIC_PAYOUT_REVIEW_NOTE = 'Payout failed. Detailed provider diagnostics are retained in controlled server logs.';

const round2 = (n) => Math.round(n * 100) / 100;
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '');

async function clearMigrationClaim(sr, withdrawal) {
  if (!withdrawal?.campaign_id || !withdrawal?.migration_request_id) return;
  const result = await sr.entities.Campaign.updateMany(
    { id: withdrawal.campaign_id, active_migration_request_id: withdrawal.migration_request_id },
    { $unset: { active_migration_request_id: '' } },
  );
  if (!result?.success || result.updated !== 1) {
    console.error('requestWithdrawal migration claim reconciliation incomplete:', {
      campaign_id: withdrawal.campaign_id,
      migration_request_id: withdrawal.migration_request_id,
      withdrawal_id: withdrawal.id,
    });
  }
}

async function reconcileApprovedPayout(sr, withdrawal) {
  const deterministicBatchId = `IFW_${withdrawal.id}`;
  const payout = await getPayoutBatch(deterministicBatchId);
  if (!payout) {
    return { found: false, finalized: false };
  }

  const finalized = await sr.entities.Withdrawal.updateMany(
    { id: withdrawal.id, status: 'processing', review_action: 'approve' },
    {
      $set: {
        status: 'paid',
        payout_batch_id: payout.payout_batch_id || deterministicBatchId,
        processed_at: new Date().toISOString(),
        review_note: `Payout reconciled from PayPal batch ${payout.payout_batch_id || deterministicBatchId}.`,
      },
    },
  );

  if (finalized.success && finalized.updated === 1) {
    await clearMigrationClaim(sr, withdrawal);
  }

  return { found: true, finalized: finalized.success && finalized.updated === 1 };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Sign in to withdraw funds." }, { status: 401 });

    const body = await req.json();
    const action = body.action || "request";

    // ---- Admin: clear an institutional donation for withdrawal ----
    if (action === "clear") {
      if (user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });
      const d = await sr.entities.Donation.get(body.donation_id);
      if (!d) return Response.json({ error: "Donation not found." }, { status: 404 });
      if (!d.is_institutional) return Response.json({ error: "Only institutional donations need clearing." }, { status: 400 });
      await sr.entities.Donation.update(d.id, { cleared: true });
      return Response.json({ ok: true, donation_id: d.id, cleared: true });
    }

    // ---- Admin: reconcile an approved payout after a provider-success/local-write failure ----
    if (action === "reconcileApprove") {
      if (user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });
      const withdrawalId = String(body.withdrawal_id || '').trim();
      if (!withdrawalId) return Response.json({ error: "Withdrawal id is required." }, { status: 400 });
      const w = await sr.entities.Withdrawal.get(withdrawalId);
      if (!w) return Response.json({ error: "Withdrawal not found." }, { status: 404 });
      if (w.status !== "processing" || w.review_action !== "approve") {
        if (w.status === "paid") {
          await clearMigrationClaim(sr, w);
          return Response.json({ ok: true, status: "paid", withdrawal_id: w.id, payout_batch_id: w.payout_batch_id });
        }
        return Response.json({ error: "Only an approval-owned processing withdrawal can be reconciled." }, { status: 409 });
      }

      const reconciliation = await reconcileApprovedPayout(sr, w);
      if (reconciliation.finalized) {
        return Response.json({ ok: true, status: "paid", withdrawal_id: w.id, payout_batch_id: `IFW_${w.id}` });
      }
      return Response.json({
        error: reconciliation.found
          ? "PayPal confirms the payout, but the local finalization is still pending. Retry reconciliation."
          : "PayPal has not yet confirmed this deterministic payout identity. Keep the withdrawal held and retry reconciliation after provider state is available.",
      }, { status: 409 });
    }

    // ---- Admin: approve a withdrawal held for review ----
    if (action === "approve") {
      if (user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });
      const w = await sr.entities.Withdrawal.get(body.withdrawal_id);
      if (!w) return Response.json({ error: "Withdrawal not found." }, { status: 404 });
      if (w.status !== "under_review") {
        if (w.status === "processing") return Response.json({ error: w.review_action === "deny" ? "This withdrawal is being denied. Reconcile the denial before attempting approval." : "This payout is already being processed. Reconcile its PayPal state before retrying." }, { status: 409 });
        return Response.json({ error: "Only held withdrawals can be approved." }, { status: 400 });
      }

      const claimToken = `IFPAYOUT_${w.id}_${crypto.randomUUID()}`;
      const claim = await sr.entities.Withdrawal.updateMany(
        { id: w.id, status: "under_review" },
        {
          $set: {
            status: "processing",
            payout_claim_token: claimToken,
            payout_claimed_at: new Date().toISOString(),
            review_action: "approve",
            reviewed_by_id: user.id,
            reviewed_at: new Date().toISOString(),
          },
        },
      );
      if (!claim.success || claim.updated !== 1) {
        return Response.json({ error: "This payout is already being processed or has changed state. Reconcile its current status before retrying." }, { status: 409 });
      }

      try {
        const payout = await sendPayout({
          receiver: w.paypal_email,
          amount: w.net_amount,
          note: `Interplanetary Fund withdrawal for \"${w.campaign_title}\"`,
          itemId: `IFW_${w.id}`,
        });
        const finalized = await sr.entities.Withdrawal.updateMany(
          { id: w.id, status: "processing", payout_claim_token: claimToken, review_action: "approve" },
          {
            $set: {
              status: "paid",
              payout_batch_id: payout.payout_batch_id,
              processed_at: new Date().toISOString(),
            },
            $unset: {
              payout_claim_token: '',
              payout_claimed_at: '',
              review_action: '',
            },
          },
        );
        if (!finalized.success || finalized.updated !== 1) {
          const reconciliation = await reconcileApprovedPayout(sr, await sr.entities.Withdrawal.get(w.id));
          if (reconciliation.finalized) {
            return Response.json({ ok: true, status: "paid", payout_batch_id: reconciliation.payout_batch_id || payout.payout_batch_id });
          }
          return Response.json({ error: "PayPal accepted the payout but local finalization is pending. Reconcile this withdrawal before retrying approval." }, { status: 409 });
        }
        await clearMigrationClaim(sr, w);
        return Response.json({ ok: true, status: "paid", payout_batch_id: payout.payout_batch_id });
      } catch (err) {
        console.error("requestWithdrawal approve payout error:", err?.message || err);
        try {
          const reconciliation = await reconcileApprovedPayout(sr, await sr.entities.Withdrawal.get(w.id));
          if (reconciliation.finalized) {
            return Response.json({ ok: true, status: "paid", withdrawal_id: w.id, payout_batch_id: `IFW_${w.id}` });
          }
        } catch (lookupError) {
          console.error("requestWithdrawal payout reconciliation error:", lookupError?.message || lookupError);
        }

        // Do not mark a provider-ambiguous payout failed. The processing+approve
        // claim remains intact so a later reconcileApprove call can safely query
        // the deterministic PayPal batch identity without submitting a second payout.
        return Response.json({ error: "The payout provider outcome could not be confirmed. The withdrawal remains held for safe reconciliation; do not retry approval until the PayPal state is checked." }, { status: 409 });
      }
    }

    // ---- User: request a new withdrawal ----
    const { campaign_id, paypal_email, paypal_email_confirm } = body;
    if (!campaign_id) return Response.json({ error: "Select a campaign to withdraw from." }, { status: 400 });
    if (!emailOk(paypal_email)) return Response.json({ error: "Enter a valid PayPal email address." }, { status: 400 });
    if (paypal_email !== paypal_email_confirm) return Response.json({ error: "PayPal email addresses do not match." }, { status: 400 });

    const campaign = await sr.entities.Campaign.get(campaign_id);
    if (!campaign) return Response.json({ error: "Campaign not found." }, { status: 404 });
    if (campaign.created_by_id !== user.id) {
      return Response.json({ error: "You can only withdraw funds from your own campaigns." }, { status: 403 });
    }

    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const recent = await sr.entities.Withdrawal.filter({ owner_user_id: user.id });
    const alreadyToday = (recent || []).some((w) => {
      if (w.status === "failed") return false;
      return new Date(w.created_date) >= startToday;
    });
    if (alreadyToday) {
      return Response.json({ error: "You can only withdraw once per day. Please try again tomorrow." }, { status: 400 });
    }

    const cutoff = new Date(Date.now() - CLEARING_DAYS * 86400000);
    const allDonations = await sr.entities.Donation.filter({ campaign_id });
    const available = (allDonations || []).filter((d) => !d.withdrawal_id && (d.is_institutional ? d.cleared : new Date(d.created_date) <= cutoff));
    const gross = round2(available.reduce((s, d) => s + (d.amount || 0), 0));
    if (gross <= 0) {
      return Response.json({ error: "No cleared funds are available yet. Donations become withdrawable after a 7-day clearing period." }, { status: 400 });
    }

    const fee = round2(gross * PLATFORM_FEE_RATE);
    const net = round2(gross - fee);

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
      status: "processing",
    });

    await sr.entities.Donation.bulkUpdate(available.map((d) => ({ id: d.id, withdrawal_id: withdrawal.id })));

    if (net > REVIEW_THRESHOLD) {
      await sr.entities.Withdrawal.update(withdrawal.id, {
        status: "under_review",
        review_note: `Net amount $${net.toFixed(2)} exceeds the $${REVIEW_THRESHOLD} auto-approval threshold.`,
      });
      return Response.json({ ok: true, status: "under_review", withdrawal_id: withdrawal.id, gross, fee, net });
    }

    try {
      const payout = await sendPayout({
        receiver: paypal_email,
        amount: net,
        note: `Interplanetary Fund withdrawal for \"${campaign.title}\"`,
        itemId: `IFW_${withdrawal.id}`,
      });
      const finalized = await sr.entities.Withdrawal.updateMany(
        { id: withdrawal.id, status: "processing" },
        {
          $set: {
            status: "paid",
            payout_batch_id: payout.payout_batch_id,
            processed_at: new Date().toISOString(),
          },
        },
      );
      if (!finalized.success || finalized.updated !== 1) {
        return Response.json({ error: "PayPal accepted the payout but local finalization is pending. The withdrawal remains held for reconciliation." }, { status: 409 });
      }
      await clearMigrationClaim(sr, withdrawal);
      return Response.json({ ok: true, status: "paid", withdrawal_id: withdrawal.id, gross, fee, net, payout_batch_id: payout.payout_batch_id });
    } catch (err) {
      console.error("requestWithdrawal payout error:", err?.message || err);
      try {
        const reconciliation = await reconcileApprovedPayout(sr, await sr.entities.Withdrawal.get(withdrawal.id));
        if (reconciliation.finalized) {
          return Response.json({ ok: true, status: "paid", withdrawal_id: withdrawal.id, gross, fee, net, payout_batch_id: `IFW_${withdrawal.id}` });
        }
      } catch (lookupError) {
        console.error("requestWithdrawal initial payout reconciliation error:", lookupError?.message || lookupError);
      }
      await sr.entities.Donation.bulkUpdate(available.map((d) => ({ id: d.id, withdrawal_id: "" })));
      await sr.entities.Withdrawal.update(withdrawal.id, { status: "failed", review_note: GENERIC_PAYOUT_REVIEW_NOTE });
      await clearMigrationClaim(sr, withdrawal);
      return Response.json({ error: `${SAFE_PAYOUT_ERROR} Your funds were released back to your available balance.` }, { status: 500 });
    }
  } catch (error) {
    console.error("requestWithdrawal error:", error?.message || error);
    return Response.json({ error: SAFE_WITHDRAWAL_ERROR }, { status: 500 });
  }
}
