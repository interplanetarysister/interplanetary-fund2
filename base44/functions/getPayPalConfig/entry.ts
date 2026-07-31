import { secrets } from 'base44:runtime';

// Exposes the PayPal client id (public-safe) and mode to the frontend so the
// Google Pay button can initialize the PayPal JS SDK. The client secret stays
// server-side and is only used by the order create/capture functions.
export default async function (_req) {
  return Response.json({
    client_id: secrets.get('PAYPAL_CLIENT_ID'),
    mode: secrets.get('PAYPAL_MODE') === 'live' ? 'live' : 'sandbox',
  });
}