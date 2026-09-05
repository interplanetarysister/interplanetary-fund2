import { secrets } from 'base44:runtime';
import { assertPlatformAccess, resolveConvex } from './integrationRegistry.ts';
import { giftOf, round2 } from './fees.js';

function mutationUrl() {
  const resolved = resolveConvex(secrets.get('CONVEX_QUERY_URL'));
  if (!resolved.url) throw new Error('Convex endpoint not configured (CONVEX_QUERY_URL).');
  return resolved.url.replace(/\/api\/query$/, '/api/mutation');
}

async function invokeCanonicalMutation(sr, path, args, purpose = 'canonical write') {
  const access = await assertPlatformAccess(sr, 'convex');
  if (!access.ok) throw new Error(`Convex ${purpose} unavailable: ${access.reason}`);

  const token = secrets.get('CONVEX_AUTH_TOKEN');
  if (!token) throw new Error(`CONVEX_AUTH_TOKEN is required for ${purpose}.`);

  const res = await fetch(mutationUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ path, args, format: 'json' }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status === 'error') {
    throw new Error(`Convex ${purpose} failed: ${json.errorMessage || res.status}`);
  }
  return json.status === 'success' ? json.value : json;
}

export async function recordCanonicalDonation(sr, args) {
  return invokeCanonicalMutation(sr, 'financialIntegrity:recordDonation', args, 'financial write');
}

export async function recordCanonicalExternalObservation(sr, args) {
  return invokeCanonicalMutation(sr, 'externalFinancialObservations:recordObservation', args, 'external financial observation');
}

function registrationArgs(campaign) {
  return {
    ifCampaignId: campaign.id,
    title: campaign.title || 'Untitled campaign',
    goalAmount: Number(campaign.goal_amount || 0),
    summary: campaign.summary || '',
    category: campaign.category || '',
    status: campaign.status || 'draft',
    outreachEnabled: Boolean(campaign.outreach_enabled),
    paymentActive: campaign.payment_active !== false,
    storyPresent: Boolean(campaign.story && String(campaign.story).trim()),
    ...(campaign.end_date ? { endDate: campaign.end_date } : {}),
    coverImagePresent: Boolean(campaign.cover_image_url),
    ...(campaign.cover_image_url ? { coverImageUrl: campaign.cover_image_url } : {}),
  };
}

function legacyConfirmed(donation) {
  if (!donation || donation.canonical_operation_id) return false;
  if (donation.is_institutional) return donation.cleared === true && donation.payment_verified !== false;
  return donation.payment_verified !== false;
}

export async function ensureCanonicalCampaign(sr, campaign) {
  if (!campaign?.id) throw new Error('Campaign is required for canonical registration.');

  const baseArgs = registrationArgs(campaign);
  const registered = await invokeCanonicalMutation(
    sr,
    'applicationCampaignBridge:upsertApplicationCampaign',
    baseArgs,
    'campaign registration'
  );

  if (!registered?.needsLegacyBaseline) return registered;

  const rows = await sr.entities.Donation.filter({ campaign_id: campaign.id }, '-created_date', 5000).catch(() => []);
  if (rows.length >= 5000) {
    throw new Error('Legacy campaign baseline exceeds the safe migration batch size. Run the dedicated financial migration before accepting new payments.');
  }

  const legacy = rows.filter(legacyConfirmed);
  const legacyRaisedAmount = round2(legacy.reduce((sum, d) => sum + giftOf(d), 0));
  const legacyDonorCount = legacy.length;
  const legacyAvailableBalance = round2(
    legacy.filter((d) => !d.withdrawal_id).reduce((sum, d) => sum + giftOf(d), 0)
  );

  return invokeCanonicalMutation(
    sr,
    'applicationCampaignBridge:upsertApplicationCampaign',
    {
      ...baseArgs,
      campaignOwnerUserId: campaign.created_by_id || '',
      legacyRaisedAmount,
      legacyDonorCount,
      legacyAvailableBalance,
    },
    'campaign financial baseline registration'
  );
}

export async function reserveCanonicalWithdrawal(sr, args) {
  return invokeCanonicalMutation(sr, 'financialIntegrity:reserveWithdrawal', args, 'withdrawal reservation');
}

export async function completeCanonicalWithdrawal(sr, args) {
  return invokeCanonicalMutation(sr, 'financialIntegrity:completeWithdrawal', args, 'withdrawal completion');
}

export async function cancelCanonicalWithdrawal(sr, args) {
  return invokeCanonicalMutation(sr, 'financialIntegrity:cancelWithdrawal', args, 'withdrawal cancellation');
}

export async function mirrorCanonicalCampaignTotal(sr, campaignId, canonical) {
  if (!canonical || !Number.isFinite(Number(canonical.raisedAmount)) || !Number.isFinite(Number(canonical.donorCount))) return;
  await sr.entities.Campaign.update(campaignId, {
    raised_amount: Number(canonical.raisedAmount),
    donor_count: Number(canonical.donorCount),
  });
}
