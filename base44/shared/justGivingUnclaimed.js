// JustGiving staging-only unclaimed fundraising-page adapter.
// Endpoint: https://api.justgiving.com/docs/resources/v1/UnclaimedPages/RegisterFundraisingPage
// JustGiving remains custodian of all money. Creating an unclaimed page does
// not grant IFund withdrawal, payment, or posting permissions for that user.
const ACTIVITY_TYPES = new Set([
  'Running_Marathons', 'Treks', 'Walks', 'Cycling', 'Swimming', 'Triathlons',
  'Parachuting_Skydives', 'OtherSportingEvents', 'OtherPersonalChallenge',
  'PersonalRunning_Marathons', 'PersonalTreks', 'PersonalWalks', 'PersonalCycling',
  'PersonalSwimming', 'PersonalTriathlons', 'PersonalParachuting_Skydives',
  'PersonalStreaming_Gaming',
]);

export const JUSTGIVING_STAGING_ENDPOINT = 'https://api.staging.justgiving.com';
export const JUSTGIVING_UNCLAIMED_PATH = '/v1/fundraising/unclaimedpages';

export function pageSlug(campaign) {
  const suffix = String(campaign?.id || '').replace(/[^A-Za-z0-9]/g, '').slice(-22).toLowerCase();
  if (suffix.length < 6) throw new Error('Campaign identifier is invalid.');
  return `ifund-${suffix}`;
}

export function createUnclaimedPayload(campaign, fields) {
  if (!campaign?.id || !campaign.title || !String(campaign.story || campaign.summary || '').trim())
    throw new Error('Complete the IFund campaign title and story before exporting.');
  const charityId = Number(fields?.charity_id);
  if (!Number.isSafeInteger(charityId) || charityId <= 0 || charityId > 2147483647)
    throw new Error('A valid JustGiving registered charity ID is required.');
  const activityType = String(fields?.activity_type || '').trim();
  if (!ACTIVITY_TYPES.has(activityType))
    throw new Error('Choose a supported JustGiving non-event activity.');
  const amount = Number(campaign.goal_amount);
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error('Set a positive campaign fundraising goal.');
  const currency = String(fields?.currency || 'GBP').toUpperCase();
  if (!['GBP', 'USD', 'EUR', 'AUD', 'CAD'].includes(currency))
    throw new Error('Select a supported donation currency.');
  return {
    charityId,
    pageShortName: pageSlug(campaign),
    pageTitle: String(campaign.title).slice(0, 180),
    pageStory: String(campaign.story || campaign.summary).slice(0, 9000),
    targetAmount: String(Math.round(amount * 100) / 100),
    currency,
    activityType,
    charityOptIn: false,
    charityFunded: false,
    consistentErrorResponses: true,
    reference: `IFUND-${String(campaign.id).replace(/[^A-Za-z0-9]/g,'').slice(-26)}`,
  };
}

export function validateJustGivingCreateResult(result) {
  if (!result || !Number.isSafeInteger(Number(result.pageId)) || Number(result.pageId) <= 0)
    throw new Error('JustGiving did not confirm a page ID.');
  const candidate = String(result?.next?.uri || '').trim();
  const link = new URL(candidate);
  const host = link.hostname.toLowerCase();
  if (link.protocol !== 'https:' || link.username || link.password ||
    !(host === 'justgiving.com' || host === 'www.justgiving.com' || host.endsWith('.staging.justgiving.com')))
    throw new Error('JustGiving returned an unverified page URL.');
  return { page_id: String(result.pageId), page_url: link.href };
}

// Never return provider errors or account API keys to the frontend.
export async function createJustGivingStagingPage({ appId, payload, fetchFn = fetch }) {
  if (!/^[a-zA-Z0-9_-]{4,128}$/.test(String(appId || ''))) throw new Error('JustGiving AppID is not configured.');
  const response = await fetchFn(`${JUSTGIVING_STAGING_ENDPOINT}/${encodeURIComponent(appId)}${JUSTGIVING_UNCLAIMED_PATH}`, {
    method: 'PUT',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-api-key': appId,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 409) return { ok: false, status: 'provider_conflict' };
  if (response.status !== 201) return { ok: false, status: 'provider_rejected', http_status: response.status };
  const result = await response.json().catch(() => null);
  const verified = validateJustGivingCreateResult(result);
  // Claim URL may embed a claim token. Return it to the signed-in owner ONCE,
  // and never persist it to general entity storage, logs, or public pages.
  const claim = String(result?.signOnUrl || '');
  let claim_url = '';
  try {
    const u = new URL(claim);
    if (u.protocol === 'https:' && ['justgiving.com','www.justgiving.com','www.staging.justgiving.com'].includes(u.hostname.toLowerCase()))
      claim_url = u.href;
  } catch (_) { /* no claim URL */ }
  return { ok: true, status: 'staging_created', ...verified, claim_url };
}
