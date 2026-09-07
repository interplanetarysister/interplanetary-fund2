import { secrets } from 'base44:runtime';

// Public-safe payment capability snapshot. UI must use this instead of
// inferring provider availability from rendered components or repository code.
export default async function (_req) {
  const paypalClientId = secrets.get('PAYPAL_CLIENT_ID');
  const paypalClientSecret = secrets.get('PAYPAL_CLIENT_SECRET');
  const paypalMode = secrets.get('PAYPAL_MODE') === 'live' ? 'live' : 'sandbox';
  const stripeSecret = secrets.get('STRIPE_SECRET_KEY');

  return Response.json({
    paypal: {
      // The canonical paypal.com donation-link path is independently available
      // and does not require REST API credentials. Do not conflate it with SDK/API checkout.
      donation_link_available: true,
      api_configured: Boolean(paypalClientId && paypalClientSecret),
      api_live: Boolean(paypalClientId && paypalClientSecret && paypalMode === 'live'),
      mode: paypalMode,
    },
    stripe: {
      configured: Boolean(stripeSecret),
    },
  });
}
