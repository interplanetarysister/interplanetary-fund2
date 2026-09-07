import { secrets } from 'base44:runtime';

// Public-safe PayPal capability snapshot. This endpoint deliberately derives
// status from the runtime configuration instead of letting the frontend guess.
// The client secret is never returned.
export default async function (_req) {
  const clientId = secrets.get('PAYPAL_CLIENT_ID');
  const clientSecret = secrets.get('PAYPAL_CLIENT_SECRET');
  const mode = secrets.get('PAYPAL_MODE') === 'live' ? 'live' : 'sandbox';

  return Response.json({
    client_id: clientId || null,
    mode,
    configured: Boolean(clientId && clientSecret),
    live: Boolean(clientId && clientSecret && mode === 'live'),
    provider: 'paypal',
  });
}