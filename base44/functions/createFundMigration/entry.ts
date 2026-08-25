import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const PLATFORM_FEE_RATE = 0.08;
const MAX_GROSS_AMOUNT = 1_000_000;
const SAFE_ERROR = 'Unable to record the fund migration. Please try again or contact support.';
const ALLOWED_SOURCE_PLATFORMS = new Set([
  'GoFundMe',
  'Kickstarter',
  'Indiegogo',
  'Facebook',
  'GiveSendGo',
  'CashApp',
  'PayPal',
  'Other',
]);
const ALLOWED_PAYOUT_METHODS = new Set(['paypal']);

const round2 = (value) => Math.round(value * 100) / 100;
const validEmail = (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validRequestId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{16,100}$/.test(value);

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Sign in to continue.' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required.' }, { status: 403 });

    const body = await req.json();
    const {
      request_id: requestId,
      campaign_id: campaignId,
      source_platform: sourcePlatform,
      gross_amount: rawGrossAmount,
      payout_method: payoutMethod,
      payout_destination: payoutDestination,
    } = body || {};

    if (!validRequestId(requestId)) return Response.json({ error: 'A valid migration request id is required.' }, { status: 400 });
    if (typeof campaignId !== 'string' || !campaignId) return Response.json({ error: 'Select a campaign.' }, { status: 400 });
    if (!ALLOWED_SOURCE_PLATFORMS.has(sourcePlatform)) return Response.json({ error: 'Unsupported source platform.' }, { status: 400 });
    if (!ALLOWED_PAYOUT_METHODS.has(payoutMethod)) return Response.json({ error: 'This migration workflow currently supports PayPal payouts only.' }, { status: 400 });
    if (!validEmail(payoutDestination)) return Response.json({ error: 'Enter a valid PayPal payout destination.' }, { status: 400 });

    const grossAmount = Number(rawGrossAmount);
    if (!Number.isFinite(grossAmount) || grossAmount <= 0 || grossAmount > MAX_GROSS_AMOUNT) {
      return Response.json({ error: 'Enter a valid migration amount.' }, { status: 400 });
    }

    const campaign = await sr.entities.Campaign.get(campaignId);
    if (!campaign) return Response.json({ error: 'Campaign not found.' }, { status: 404 });
    if (!campaign.created_by_id) return Response.json({ error: 'Selected campaign has no verified owner.' }, { status: 409 });

    // Retry reconciliation happens before claim acquisition so a network retry
    // cannot create a second Withdrawal for the same stable request id.
    const existing = (await sr.entities.Withdrawal.filter({ migration_request_id: requestId }))[0];
    if (existing) {
      return Response.json({
        ok: true,
        duplicate: true,
        withdrawal_id: existing.id,
        status: existing.status,
        gross: existing.gross_amount,
        fee: existing.platform_fee,
        net: existing.net_amount,
      });
    }

    // Conditional campaign-level claim serializes migrations for a campaign.
    // The same request id may resume after a client/network retry; another
    // request cannot take the claim while this migration remains unresolved.
    const claim = await sr.entities.Campaign.updateMany(
      {
        id: campaignId,
        $or: [
          { active_migration_request_id: { $exists: false } },
          { active_migration_request_id: '' },
          { active_migration_request_id: requestId },
        ],
      },
      { $set: { active_migration_request_id: requestId } },
    );

    if (!claim.success || claim.updated !== 1) {
      return Response.json({ error: 'A migration for this campaign is already being processed. Retry after it is resolved.' }, { status: 409 });
    }

    const gross = round2(grossAmount);
    const platformFee = round2(gross * PLATFORM_FEE_RATE);
    const net = round2(gross - platformFee);
    if (net <= 0) {
      await sr.entities.Campaign.updateMany(
        { id: campaignId, active_migration_request_id: requestId },
        { $unset: { active_migration_request_id: '' } },
      );
      return Response.json({ error: 'Migration amount must exceed the platform fee.' }, { status: 400 });
    }

    try {
      const withdrawal = await sr.entities.Withdrawal.create({
        owner_user_id: campaign.created_by_id,
        user_name: user.full_name || user.name || '',
        campaign_id: campaign.id,
        campaign_title: campaign.title,
        gross_amount: gross,
        platform_fee: platformFee,
        net_amount: net,
        paypal_email: payoutDestination,
        source_platform: sourcePlatform,
        payout_method: payoutMethod,
        payout_destination: payoutDestination,
        migration_request_id: requestId,
        status: 'under_review',
        review_note: `Fund migration from ${sourcePlatform} requires payout workflow approval. Requested by administrator ${user.id}.`,
      });

      return Response.json({ ok: true, withdrawal_id: withdrawal.id, status: withdrawal.status, gross, fee: platformFee, net });
    } catch (error) {
      console.error('createFundMigration create withdrawal error:', error?.message || error);
      await sr.entities.Campaign.updateMany(
        { id: campaignId, active_migration_request_id: requestId },
        { $unset: { active_migration_request_id: '' } },
      );
      return Response.json({ error: SAFE_ERROR }, { status: 500 });
    }
  } catch (error) {
    console.error('createFundMigration error:', error?.message || error);
    return Response.json({ error: SAFE_ERROR }, { status: 500 });
  }
}
