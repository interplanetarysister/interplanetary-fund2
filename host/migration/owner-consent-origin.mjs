/**
 * Verify browser request provenance for the dormant owner-link endpoint.
 * Browsers usually omit Origin on same-origin GET fetches. In that case,
 * require Fetch Metadata proving same-origin script-initiated navigation.
 * POST always requires an exact Origin; never trust client-supplied identities.
 */
const ALLOWED_ORIGINS = new Set([
  'https://interplanetaryfund.com',
  'https://www.interplanetaryfund.com',
]);

export function ownerConsentOriginAllowed(request, url) {
  if (url.protocol !== 'https:' || !ALLOWED_ORIGINS.has(url.origin)) return false;
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  const mode = request.headers.get('sec-fetch-mode');
  if (site && site !== 'same-origin') return false;
  if (request.method !== 'GET') return origin === url.origin;
  if (origin !== null) return origin === url.origin;
  return site === 'same-origin' && (mode === 'cors' || mode === 'same-origin');
}
