import { secrets } from 'base44:runtime';

// Public-safe PayPal capability snapshot. PayPal has two independent paths in
// this app: the canonical paypal.com donation link and REST/SDK checkout.
// Never label the whole provider offline merely because REST credentials are
// absent, and never label REST checkout live merely because a donate link works.
export default async function (_req) {
  const clientId = secrets.get('PAYPAL_CLIENT_ID');
  const clientSecret = secrets.get('PAYPAL_CLIENT_SECRET');
  const mode = secrets.get('PAYPAL_MODE') === 'live' ? 'live' : 'sandbox';
  const apiConfigured = Boolean(clientId && clientSecret);

  return Response.json({
    client_id: clientId || null,
    mode,
    configured: apiConfigured,
    live: Boolean(apiConfigured && mode === 'live'),
    donation_link_available: true,
    api_configured: apiConfigured,
    api_live: Boolean(apiConfigured && mode === 'live'),
    provider: 'paypal',
  });
}
