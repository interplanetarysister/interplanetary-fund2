import { secrets } from 'base44:runtime';
import { assertPlatformAccess, resolveConvex } from './integrationRegistry.ts';

function mutationUrl() {
  const resolved = resolveConvex(secrets.get('CONVEX_QUERY_URL'));
  if (!resolved.url) throw new Error('Convex endpoint not configured (CONVEX_QUERY_URL).');
  return resolved.url.replace(/\/api\/query$/, '/api/mutation');
}

export async function recordCanonicalDonation(sr, args) {
  const access = await assertPlatformAccess(sr, 'convex');
  if (!access.ok) throw new Error(`Convex financial boundary unavailable: ${access.reason}`);

  const token = secrets.get('CONVEX_AUTH_TOKEN');
  if (!token) throw new Error('CONVEX_AUTH_TOKEN is required for canonical financial writes.');

  const res = await fetch(mutationUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      path: 'financialIntegrity:recordDonation',
      args,
      format: 'json',
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status === 'error') {
    throw new Error(`Canonical financial write failed: ${json.errorMessage || res.status}`);
  }
  return json.status === 'success' ? json.value : json;
}

// Base44 financial records are display/application mirrors only. Campaign
// totals are set to the canonical absolute values returned by Convex, never
// incremented locally. That makes retries safe even when the same mirror step
// executes more than once.
export async function mirrorCanonicalCampaignTotal(sr, campaignId, canonical) {
  if (!canonical || !Number.isFinite(Number(canonical.raisedAmount)) || !Number.isFinite(Number(canonical.donorCount))) return;
  await sr.entities.Campaign.update(campaignId, {
    raised_amount: Number(canonical.raisedAmount),
    donor_count: Number(canonical.donorCount),
  });
}
